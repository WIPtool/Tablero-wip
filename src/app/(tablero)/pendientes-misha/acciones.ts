'use server';

import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo } from '@/lib/config';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

// Acciones de "Pendientes Misha". Corren con la sesión de la persona (regla "equipo_edita"); "actualizado" lo pone la base.
const ESTADOS = ['nuevo', 'hecho', 'descartado', 'accion'];

async function quien() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  return { supabase, email: (data?.claims?.email as string | undefined) ?? '' };
}

// Hecho, Descartar y Reabrir.
export async function cambiarEstado(datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  const estado = String(datos.get('estado') ?? '');
  if (!id || !ESTADOS.includes(estado)) return;
  await supabase.from('pendientes_misha').update({ estado }).eq('id', id);
  revalidatePath('/pendientes-misha');
}

// Tomar acción: la instrucción queda sin atender hasta que Claude deje su respuesta.
export async function guardarInstruccion(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar los pendientes.' };
  const id = Number(datos.get('id'));
  const instruccion = String(datos.get('instruccion') ?? '').trim();
  if (!id) return { ok: false, mensaje: 'No se encontró el pendiente.' };
  if (!instruccion) return { ok: false, mensaje: 'Escribe qué quieres que haga Claude con este correo.' };

  const { error } = await supabase.from('pendientes_misha')
    .update({ instruccion, instruccion_atendida: false, estado: 'accion' }).eq('id', id);
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/pendientes-misha');
  return { ok: true, mensaje: 'Instrucción guardada. Claude la atiende en su próxima revisión.' };
}
