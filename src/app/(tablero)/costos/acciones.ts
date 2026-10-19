'use server';

import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo } from '@/lib/config';

// Acciones de la página de costos de marketing. Corren en el servidor con la sesión de la persona:
// la base solo acepta cambios de cuentas @wiptool.com (regla "equipo_edita").
export interface Resultado { ok: boolean; mensaje: string }

const esFecha = (v: FormDataEntryValue | null) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const texto = (datos: FormData, campo: string) => String(datos.get(campo) ?? '').trim();
// Acepta "455.038" o "455038" (pesos), "14,87" o "14.87" (dólares) y "1.234,5".
const monto = (datos: FormData, campo = 'monto') => {
  const v = texto(datos, campo).replace(/[\s$]/g, '');
  if (v.includes(',')) return Number(v.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return Number(v.replace(/\./g, ''));
  return Number(v);
};
const moneda = (datos: FormData) => (datos.get('moneda') === 'USD' ? 'USD' : 'COP');
const COBROS = ['mensual', 'anual', 'prepago', 'consumo', 'gratis'];
const ESTADOS = ['activo', 'prueba', 'suspendido', 'por_confirmar'];
const ESTADOS_PAGO = ['pagado', 'pendiente', 'fallido'];

async function quien() {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? '';
  return { supabase, email };
}

export async function agregarCosto(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar los costos.' };

  const plataforma = texto(datos, 'plataforma');
  const valor = monto(datos);
  const cobro = COBROS.includes(texto(datos, 'cobro')) ? texto(datos, 'cobro') : 'mensual';
  const estado = ESTADOS.includes(texto(datos, 'estado')) ? texto(datos, 'estado') : 'activo';
  const desde = datos.get('desde');
  const hasta = datos.get('hasta');
  const proximo = datos.get('proximo_pago');

  if (!plataforma) return { ok: false, mensaje: 'Escribe el nombre de la plataforma o suscripción.' };
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, mensaje: 'La licencia mensual debe ser un número mayor o igual a cero.' };
  if (!esFecha(desde)) return { ok: false, mensaje: 'Elige la fecha desde la que está activo.' };
  if (hasta && !esFecha(hasta)) return { ok: false, mensaje: 'La fecha final no es válida.' };
  if (hasta && String(hasta) < String(desde)) return { ok: false, mensaje: 'La fecha final no puede ser anterior a la inicial.' };
  if (proximo && !esFecha(proximo)) return { ok: false, mensaje: 'La fecha del próximo pago no es válida.' };

  const { error } = await supabase.from('costos_fijos').insert({
    plataforma, monto: valor, moneda: moneda(datos), desde: String(desde), hasta: hasta ? String(hasta) : null,
    categoria: texto(datos, 'categoria') || 'Herramientas de marketing', para_que: texto(datos, 'para_que'), nota: texto(datos, 'nota'),
    cobro, estado, proximo_pago: proximo ? String(proximo) : null, metodo_pago: texto(datos, 'metodo_pago'),
    // Lo que está en prueba, es gratis o se cobra por consumo no suma la licencia a la inversión.
    suma_inversion: estado !== 'prueba' && (cobro === 'mensual' || cobro === 'anual'),
    actualizado_por: email,
  });
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/costos');
  return { ok: true, mensaje: `${plataforma} quedó agregado.` };
}

export async function agregarGasto(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar los costos.' };
  const plataforma = texto(datos, 'plataforma');
  const valor = monto(datos);
  const fecha = datos.get('fecha');
  if (!plataforma) return { ok: false, mensaje: 'Elige la plataforma.' };
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, mensaje: 'El valor debe ser un número mayor o igual a cero.' };
  if (!esFecha(fecha)) return { ok: false, mensaje: 'Elige la fecha.' };
  const { error } = await supabase.from('gastos').insert({
    plataforma, monto: valor, moneda: moneda(datos), fecha: String(fecha), concepto: texto(datos, 'concepto'),
    suma_inversion: datos.get('suma_inversion') !== 'no', actualizado_por: email,
  });
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/costos');
  return { ok: true, mensaje: `Gasto de ${plataforma} registrado.` };
}

export async function agregarPago(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden editar los costos.' };
  const plataforma = texto(datos, 'plataforma');
  const valor = monto(datos);
  const fecha = datos.get('fecha');
  const estado = ESTADOS_PAGO.includes(texto(datos, 'estado')) ? texto(datos, 'estado') : 'pagado';
  if (!plataforma) return { ok: false, mensaje: 'Elige la plataforma.' };
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, mensaje: 'El valor debe ser un número mayor o igual a cero.' };
  if (!esFecha(fecha)) return { ok: false, mensaje: 'Elige la fecha del pago.' };
  const { error } = await supabase.from('pagos').insert({
    plataforma, monto: valor, moneda: moneda(datos), fecha: String(fecha), estado,
    referencia: texto(datos, 'referencia'), nota: texto(datos, 'nota'), actualizado_por: email,
  });
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/costos');
  return { ok: true, mensaje: `Pago de ${plataforma} registrado.` };
}

export async function marcarPagado(datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  if (!id) return;
  await supabase.from('pagos').update({ estado: 'pagado', actualizado_por: email, actualizado: new Date().toISOString() }).eq('id', id);
  revalidatePath('/costos');
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

async function eliminar(tabla: 'costos_fijos' | 'gastos' | 'pagos', datos: FormData) {
  const { supabase, email } = await quien();
  if (!esDelEquipo(email)) return;
  const id = Number(datos.get('id'));
  if (!id) return;
  await supabase.from(tabla).delete().eq('id', id);
  revalidatePath('/costos');
}
export async function eliminarCosto(datos: FormData) { await eliminar('costos_fijos', datos); }
export async function eliminarGasto(datos: FormData) { await eliminar('gastos', datos); }
export async function eliminarPago(datos: FormData) { await eliminar('pagos', datos); }
