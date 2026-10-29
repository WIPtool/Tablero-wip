import type { Metadata } from 'next';
import { PaginaProveedores, type Proveedor } from '@/componentes/FacturasProveedor';
import type { ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'Inversión' };

// Marketing › Inversión: facturas y cobros de la pauta y de las herramientas de marketing, una pestaña por proveedor (?prov=…).
//  - Meta Ads: flujo n8n F22 con los cobros del registro de actividad de la cuenta publicitaria ("Cuenta facturada").
//    Meta no da el PDF por API: el botón de cada cobro abre el recibo en Meta con la sesión de quien lo pide.
//  - Kommo: flujo n8n F23 con los correos «Tu pedido N fue pagado con éxito»; el monto se carga aparte (no viene en el correo
//    ni en la API) y cada pedido enlaza a su factura en Kommo.
const CUENTA_META = '1212455492189816';
const PROVEEDORES: Proveedor[] = [
  { id: 'meta', titulo: 'Meta Ads', modo: 'cobros',
    pagar: `https://business.facebook.com/billing_hub/payment_activity?asset_id=${CUENTA_META}&business_id=1212453215523377`, pagarTexto: 'Facturación en Meta',
    recibo: (f) => `https://business.facebook.com/ads/manage/billing_transaction/?act=${CUENTA_META}&pdf=true&print=false&source=billing_summary&tx_type=3&txid=${encodeURIComponent(f.numero)}`,
    fuente: 'Cobros de la cuenta publicitaria Wip (act_1212455492189816) a la tarjeta registrada, leídos cada día a las 6:45 a. m. del registro de actividad de Meta. Meta no entrega el recibo por API: el botón Recibo PDF lo descarga desde Meta y necesita una sesión abierta con acceso a la cuenta publicitaria.' },
  { id: 'kommo', titulo: 'Kommo', modo: 'cobros', pagar: 'https://wiptool.kommo.com/settings/pay/', pagarTexto: 'Facturación en Kommo',
    palabras: { cobro: 'pedido', cobros: 'pedidos', numero: 'Pedido', recibo: 'Factura' },
    recibo: (f) => `https://wiptool.kommo.com/orders/${encodeURIComponent(f.numero)}/invoice`,
    fuente: 'Pedidos pagados de la cuenta de Kommo wiptool (plan Básico, por licencia), leídos cada día a las 6:50 a. m. de los correos «Tu pedido fue pagado con éxito» que llegan a misha@wiptool.com. Kommo no da la facturación por API y el correo no trae el monto: se toma del historial de pedidos de Kommo. El botón Factura la abre en Kommo y necesita una sesión abierta.' },
  { id: 'n8n', titulo: 'n8n', proximo: true },
  { id: 'brevo', titulo: 'Brevo', proximo: true },
  { id: 'anthropic', titulo: 'Claude', proximo: true },
  { id: 'explee', titulo: 'Explee', proximo: true },
];

export default async function PaginaInversion({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  return <PaginaProveedores paginaId="inversion" proveedores={PROVEEDORES} prov={typeof sp.prov === 'string' ? sp.prov : undefined} />;
}
