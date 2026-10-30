import type { Metadata } from 'next';
import { PaginaProveedores, type Proveedor } from '@/componentes/FacturasProveedor';
import type { ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'Inversión' };

// Marketing › Inversión: facturas y cobros de la pauta y de las herramientas de marketing, con la pestaña Total (en pesos) y una
// por proveedor (?prov=…), con el mismo formato que Operaciones › Gastos (componente FacturasProveedor).
//  - Meta Ads: flujo n8n F22 con los cobros del registro de actividad de la cuenta publicitaria ("Cuenta facturada").
//    Meta no da el PDF por API: el botón de cada cobro abre el recibo en Meta con la sesión de quien lo pide.
//  - Kommo: flujo n8n F23 con los correos «Tu pedido N fue pagado con éxito»; el monto se carga aparte (no viene en el correo
//    ni en la API) y cada pedido enlaza a su factura en Kommo.
//  - Brevo: flujo n8n F24 con los correos de factura de Brevo (PDF adjunto) que llegan a misha@wiptool.com; el PDF queda en el
//    bucket "facturas". El histórico se trajo una vez de billing-v2.brevo.com (solo con la sesión web; la API pública no las da).
//    Las «Written off» (WRITTEN_OFF) y las sin pagar (UNPAID) se listan pero no suman.
//  - Explee: flujo n8n F25 con los recibos de Stripe que llegan a misha@ (número y PDF; correo de facturación en Stripe = misha@
//    desde el 2026-10-29) y, de respaldo, las recargas de la API pública (/autogtm/billing/activity, solo las que falten).
//    El histórico se trajo una vez de la web de Explee con el número de factura de Stripe y el PDF en el bucket "facturas".
//  - n8n: flujo n8n F26 con los recibos de Paddle de n8n Cloud (correo); el servidor del n8n propio va en la factura de AWS.
const CUENTA_META = '1212455492189816';
const PROVEEDORES: Proveedor[] = [
  { id: 'meta', titulo: 'Meta Ads',
    palabras: { cobro: 'cobro', cobros: 'cobros', numero: 'Transacción', recibo: 'Recibo PDF', ultimo: 'Último cobro', tabla: 'Cobros y recibos' },
    pagar: `https://business.facebook.com/billing_hub/payment_activity?asset_id=${CUENTA_META}&business_id=1212453215523377`, pagarTexto: 'Facturación en Meta',
    recibo: (f) => `https://business.facebook.com/ads/manage/billing_transaction/?act=${CUENTA_META}&pdf=true&print=false&source=billing_summary&tx_type=3&txid=${encodeURIComponent(f.numero)}`,
    fuente: 'Cobros de la cuenta publicitaria Wip (act_1212455492189816) a la tarjeta registrada, leídos cada día a las 6:45 a. m. del registro de actividad de Meta. Meta no entrega el recibo por API: el botón Recibo PDF lo descarga desde Meta y necesita una sesión abierta con acceso a la cuenta publicitaria.' },
  { id: 'kommo', titulo: 'Kommo', pagar: 'https://wiptool.kommo.com/settings/pay/', pagarTexto: 'Facturación en Kommo',
    palabras: { cobro: 'pedido', cobros: 'pedidos', numero: 'Pedido', recibo: 'Factura', tabla: 'Pedidos y facturas' },
    recibo: (f) => `https://wiptool.kommo.com/orders/${encodeURIComponent(f.numero)}/invoice`,
    fuente: 'Pedidos pagados de la cuenta de Kommo wiptool (plan Básico, por licencia), leídos cada día a las 6:50 a. m. de los correos «Tu pedido fue pagado con éxito» que llegan a misha@wiptool.com. Kommo no da la facturación por API y el correo no trae el monto: se toma del historial de pedidos de Kommo. El botón Factura la abre en Kommo y necesita una sesión abierta.' },
  { id: 'n8n', titulo: 'n8n', pagar: 'https://app.n8n.cloud/', pagarTexto: 'Cuenta de n8n Cloud',
    palabras: { cobro: 'cobro', cobros: 'cobros', numero: 'Recibo', recibo: 'Recibo', enlace: 'Ver recibo', ultimo: 'Último cobro', tabla: 'Cobros y recibos' },
    recibo: (f) => f.correo_url,
    fuente: 'Suscripción de n8n Cloud (plan Starter, 24 € al mes) cobrada por Paddle a la Visa ••6020. Cada día a las 7:10 a. m. se revisan los recibos que llegan a misha@wiptool.com; el botón abre el correo, que trae el recibo de Paddle. Desde el 28 de octubre de 2026 los flujos corren en el n8n propio (n8n.wiptool.com), cuyo servidor (Lightsail, US$12 al mes) se cobra dentro de la factura de AWS, en Operaciones › Gastos. Si Cloud no se cancela antes del 11 de noviembre, vuelve a cobrar y el cobro aparece aquí.' },
  { id: 'brevo', titulo: 'Brevo', pagar: 'https://app.brevo.com/billing/account/plans/billing-history', pagarTexto: 'Facturación en Brevo',
    palabras: { cobro: 'factura', cobros: 'facturas', numero: 'Factura', recibo: 'PDF', ultimo: 'Última factura', tabla: 'Facturas' },
    recibo: (f) => `https://billing-v2.brevo.com/billing/api/v2/invoices/download/${encodeURIComponent(f.numero)}`,
    fuente: 'Facturas del plan Starter de Brevo (marketing, US$17 al mes). Brevo manda la factura de cada renovación a misha@wiptool.com y se revisa cada día a las 6:55 a. m.: del PDF se toman el número, el total y si se cobró. Las facturas anteriores se trajeron una vez del historial de Brevo. La de septiembre que Brevo dio por perdida («Written off») se lista pero no suma.' },
  { id: 'explee', titulo: 'Explee', pagar: 'https://explee.com/app-auto-gtm/billing', pagarTexto: 'Facturación en Explee',
    palabras: { cobro: 'recarga', cobros: 'recargas', numero: 'Factura', recibo: 'PDF', ultimo: 'Última recarga', tabla: 'Recargas y facturas', enlace: 'Ver en Explee' },
    recibo: () => 'https://explee.com/app-auto-gtm/billing',
    fuente: 'Recargas de saldo de Explee (prospección en frío, US$0,04 por correo enviado) y cobros directos a la tarjeta cuando el saldo se acaba, pagados por Stripe con la tarjeta ••5177. Cada día a las 7:05 a. m. se leen los recibos de Stripe que llegan a misha@wiptool.com (número de factura y PDF) y se revisa la API de Explee por si alguna recarga no trajo recibo; esas aparecen solo con fecha y monto. Las anteriores se trajeron una vez con su PDF. Los créditos de regalo no cuentan.' },
];

export default async function PaginaInversion({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  return <PaginaProveedores paginaId="inversion" proveedores={PROVEEDORES} prov={typeof sp.prov === 'string' ? sp.prov : undefined} monedaTotal="COP" />;
}
