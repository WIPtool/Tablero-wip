'use server';

import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo } from '@/lib/config';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

// Facturación por cliente y mes: alimenta MRR, ARPA, LTV, payback y NRR de ingresos en WIP General.
// Un valor por cliente y mes (si ya existe, se reemplaza).
const valorDe = (v: string) => {
  const t = v.replace(/[\s$]/g, '');
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ''));
  return Number(t);
};

export async function guardarFactura(_previo: Resultado | null, datos: FormData): Promise<Resultado> {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? '';
  if (!esDelEquipo(email)) return { ok: false, mensaje: 'Solo cuentas @wiptool.com pueden cargar la facturación.' };

  const mes = String(datos.get('mes') ?? '');
  const cliente = String(datos.get('cliente') ?? '').trim();
  const valor = valorDe(String(datos.get('valor') ?? ''));
  const moneda = datos.get('moneda') === 'USD' ? 'USD' : 'COP';
  if (!/^\d{4}-\d{2}$/.test(mes)) return { ok: false, mensaje: 'Elige el mes facturado.' };
  if (!cliente) return { ok: false, mensaje: 'Elige el cliente (con el mismo nombre que tiene en la plataforma).' };
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, mensaje: 'El valor debe ser un número mayor o igual a cero.' };

  const { error } = await supabase.from('facturacion').upsert({
    mes: `${mes}-01`, cliente, valor, moneda, nota: String(datos.get('nota') ?? '').trim(), actualizado_por: email, actualizado: new Date().toISOString(),
  }, { onConflict: 'mes,cliente' });
  if (error) return { ok: false, mensaje: 'No se pudo guardar: ' + error.message };
  revalidatePath('/general');
  return { ok: true, mensaje: `Facturación de ${cliente} guardada.` };
}

export async function eliminarFactura(datos: FormData) {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!esDelEquipo((data?.claims?.email as string | undefined) ?? '')) return;
  const id = Number(datos.get('id'));
  if (!id) return;
  await supabase.from('facturacion').delete().eq('id', id);
  revalidatePath('/general');
}
