'use server';

import { revalidatePath } from 'next/cache';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo, MODO_EJEMPLO } from '@/lib/config';

// Marca a mano una factura de Gastos o Inversión como pagada o sin pagar; con estado '' vuelve al estado automático.
// Lo guarda la función marcar_estado_factura (solo el equipo) en estado_manual, que las cargas automáticas no tocan.
const ESTADOS = ['', 'PAID', 'SIN_PAGAR'];

export async function marcarEstadoFactura(datos: FormData) {
  if (MODO_EJEMPLO) return;
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getClaims();
  if (!esDelEquipo((data?.claims?.email as string | undefined) ?? '')) return;
  const id = String(datos.get('id') ?? '');
  const estado = String(datos.get('estado') ?? '');
  if (!id || !ESTADOS.includes(estado)) return;
  await supabase.rpc('marcar_estado_factura', { p_id: id, p_estado: estado });
  revalidatePath('/gastos');
  revalidatePath('/inversion');
}
