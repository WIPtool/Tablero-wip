'use server';

import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo } from '@/lib/config';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

// Acciones de la página "Links de interés" (accionadores y propuestas). Corren con la sesión de la persona (regla "equipo_edita").
async function quien() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  return { supabase, email: (data?.claims?.email as string | undefined) ?? '' };
}

const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim();

export async function agregarAccionador(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar los accionadores.' };

  const fila = {
    plataforma: texto(datos, 'plataforma'), tipo: texto(datos, 'tipo'), accionador: texto(datos, 'accionador'),
    enlace: texto(datos, 'enlace'), que_hace: texto(datos, 'que_hace'), donde_se_ve: texto(datos, 'donde_se_ve'),
    donde_se_usa: texto(datos, 'donde_se_usa'), actualizado_por: email,
  };
  if (!fila.plataforma || !fila.accionador) return { ok: false, mensaje: 'Escribe al menos la plataforma y el nombre del accionador.' };
  if (fila.enlace && !/^https?:\/\//.test(fila.enlace)) return { ok: false, mensaje: 'El enlace debe empezar por https://' };

  const { error } = await supabase.from('accionadores').insert(fila);
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/links');
  return { ok: true, mensaje: `${fila.accionador} quedó agregado.` };
}

export async function eliminarAccionador(datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  if (!id) return;
  await supabase.from('accionadores').delete().eq('id', id);
  revalidatePath('/links');
}

export async function agregarPropuesta(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar las propuestas.' };

  const fila = {
    cliente: texto(datos, 'cliente'), documento: texto(datos, 'documento'), tipo: texto(datos, 'tipo') || 'Propuesta comercial',
    enlace: texto(datos, 'enlace'), fecha: texto(datos, 'fecha') || null, notas: texto(datos, 'notas'), actualizado_por: email,
  };
  if (!fila.cliente || !fila.documento) return { ok: false, mensaje: 'Escribe al menos el cliente y el nombre del documento.' };
  if (!/^https?:\/\//.test(fila.enlace)) return { ok: false, mensaje: 'El enlace debe empezar por https://' };

  const { error } = await supabase.from('propuestas').insert(fila);
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/links');
  return { ok: true, mensaje: `${fila.documento} (${fila.cliente}) quedó agregado.` };
}

export async function eliminarPropuesta(datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  if (!id) return;
  await supabase.from('propuestas').delete().eq('id', id);
  revalidatePath('/links');
}
