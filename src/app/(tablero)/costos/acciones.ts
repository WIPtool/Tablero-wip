'use server';

import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo } from '@/lib/config';

// Acciones de la página de costos fijos. Corren en el servidor con la sesión de la persona:
// la base solo acepta cambios de cuentas @wiptool.com (regla "equipo_edita").
export interface Resultado { ok: boolean; mensaje: string }

const esFecha = (v: FormDataEntryValue | null) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function quien() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? '';
  return { supabase, email };
}

export async function agregarCosto(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar los costos.' };

  const plataforma = String(datos.get('plataforma') ?? '').trim();
  const monto = Number(String(datos.get('monto') ?? '').replace(',', '.'));
  const moneda = datos.get('moneda') === 'USD' ? 'USD' : 'COP';
  const desde = datos.get('desde');
  const hasta = datos.get('hasta');
  const nota = String(datos.get('nota') ?? '').trim();

  if (!plataforma) return { ok: false, mensaje: 'Escribe el nombre de la plataforma o suscripción.' };
  if (!Number.isFinite(monto) || monto < 0) return { ok: false, mensaje: 'El costo mensual debe ser un número mayor o igual a cero.' };
  if (!esFecha(desde)) return { ok: false, mensaje: 'Elige la fecha desde la que se paga.' };
  if (hasta && !esFecha(hasta)) return { ok: false, mensaje: 'La fecha final no es válida.' };
  if (hasta && String(hasta) < String(desde)) return { ok: false, mensaje: 'La fecha final no puede ser anterior a la inicial.' };

  const { error } = await supabase.from('costos_fijos').insert({
    plataforma, monto, moneda, desde: String(desde), hasta: hasta ? String(hasta) : null, nota, actualizado_por: email,
  });
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/costos');
  return { ok: true, mensaje: `${plataforma} quedó agregado.` };
}

export async function terminarCosto(datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  const hasta = datos.get('hasta');
  if (!id || !esFecha(hasta)) return;
  await supabase.from('costos_fijos').update({ hasta: String(hasta), actualizado_por: email, actualizado: new Date().toISOString() }).eq('id', id);
  revalidatePath('/costos');
}

export async function eliminarCosto(datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  if (!id) return;
  await supabase.from('costos_fijos').delete().eq('id', id);
  revalidatePath('/costos');
}
