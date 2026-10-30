import type { Metadata } from 'next';
import { PaginaProveedores, type Proveedor } from '@/componentes/FacturasProveedor';
import type { ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'Inversión' };

// Marketing › Inversión: facturas y cobros de la pauta y de las herramientas de marketing, una pestaña por proveedor (?prov=…).
//  - Meta Ads: flujo n8n F22 con los cobros del registro de actividad de la cuenta publicitaria ("Cuenta facturada").
//    Meta no da el PDF por API: el botón de cada cobro abre el recibo en Meta con la sesión de quien lo pide.
//  - Kommo: flujo n8n F23 con los correos «Tu pedido N fue pagado con éxito»; el monto se carga aparte (no viene en el correo
//    ni en la API) y cada pedido enlaza a su factura en Kommo.
//  - Brevo: flujo n8n F24 con los correos de factura de Brevo (PDF adjunto) que llegan a misha@wiptool.com; el PDF queda en el
//    bucket "facturas". El histórico se trajo una vez de billing-v2.brevo.com (solo con la sesión web; la API pública no las da).
//    Las «Written off» (WRITTEN_OFF) y las sin pagar (UNPAID) se listan pero no suman.
//  - Explee: flujo n8n F25 con las recargas de saldo de la API pública (/autogtm/billing/activity, solo inserta las nuevas).
//    El histórico se trajo una vez de la web de Explee con el número de factura de Stripe y el PDF en el bucket "facturas".
const CUENTA_META = '1212455492189816';
const PROVEEDORES: Proveedor[] = [
  { id: 'meta', titulo: 'Meta Ads', modo: 'cobros',
    pagar: `https://business.facebook.com/billing_hub/payment_activity?asset_id=${CUENTA_META}&business_id=1212453215523377`, pagarTexto: 'Facturación en Meta',
    recibo: (f) => `https://business.facebook.com/ads/manage/billing_transaction/?act=${CUENTA_META}&pdf=true&print=false&source=billing_summary&tx_type=3&txid=${encodeURIComponent(f.numero)}`,
    fuente: 'Cobros de la cuenta publicitaria Wip (act_1212455492189816) a la tarjeta registrada, leídos cada día a las 6:45 a. m. del registro de actividad de Meta. Meta no entrega el recibo por API: el botón Recibo PDF lo descarga desde Meta y necesita una sesión abierta con acceso a la cuenta publicitaria.' },
  { id: 'kommo', titulo: 'Kommo', modo: 'cobros', pagar: 'https://wiptool.kommo.com/settings/pay/', pagarTexto: 'Facturación en Kommo',
    palabras: { cobro: 'pedido', cobros: 'pedidos', numero: 'Pedido', recibo: 'Factura', tabla: 'Pedidos y facturas' },
    recibo: (f) => `https://wiptool.kommo.com/orders/${encodeURIComponent(f.numero)}/invoice`,
    fuente: 'Pedidos pagados de la cuenta de Kommo wiptool (plan Básico, por licencia), leídos cada día a las 6:50 a. m. de los correos «Tu pedido fue pagado con éxito» que llegan a misha@wiptool.com. Kommo no da la facturación por API y el correo no trae el monto: se toma del historial de pedidos de Kommo. El botón Factura la abre en Kommo y necesita una sesión abierta.' },
  { id: 'n8n', titulo: 'n8n', proximo: true },
  { id: 'brevo', titulo: 'Brevo', modo: 'cobros', pagar: 'https://app.brevo.com/billing/account/plans/billing-history', pagarTexto: 'Facturación en Brevo',
    palabras: { cobro: 'factura', cobros: 'facturas', numero: 'Factura', recibo: 'PDF', ultimo: 'Última factura', tabla: 'Facturas' },
    recibo: (f) => `https://billing-v2.brevo.com/billing/api/v2/invoices/download/${encodeURIComponent(f.numero)}`,
    fuente: 'Facturas del plan Starter de Brevo (marketing, US$17 al mes). Brevo manda la factura de cada renovación a misha@wiptool.com y se revisa cada día a las 6:55 a. m.: del PDF se toman el número, el total y si se cobró. Las facturas anteriores se trajeron una vez del historial de Brevo. La de septiembre que Brevo dio por perdida («Written off») se lista pero no suma.' },
  { id: 'anthropic', titulo: 'Claude', proximo: true },
  { id: 'explee', titulo: 'Explee', modo: 'cobros', pagar: 'https://explee.com/app-auto-gtm/billing', pagarTexto: 'Facturación en Explee',
    palabras: { cobro: 'recarga', cobros: 'recargas', numero: 'Factura', recibo: 'PDF', ultimo: 'Última recarga', tabla: 'Recargas y facturas', enlace: 'Ver en Explee' },
    recibo: () => 'https://explee.com/app-auto-gtm/billing',
    fuente: 'Recargas de saldo de Explee (prospección en frío, US$0,04 por correo enviado), pagadas por Stripe con la tarjeta ••5177. Cada día a las 7:05 a. m. se revisa la API de Explee y las recargas nuevas aparecen con su fecha y monto; su número de factura y su PDF se ven en Explee, porque la API no los da. Las anteriores se trajeron una vez con su PDF. Los créditos de regalo no cuentan. Si el saldo se acaba, Explee cobra directo a la tarjeta, como los US$4,98 del 15 de septiembre: esos cobros no salen en la API.' },
];

export default async function PaginaInversion({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  return <PaginaProveedores paginaId="inversion" proveedores={PROVEEDORES} prov={typeof sp.prov === 'string' ? sp.prov : undefined} />;
}
