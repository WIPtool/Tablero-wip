import type { Metadata } from 'next';
import { PaginaProveedores, type Proveedor } from '@/componentes/FacturasProveedor';
import type { ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'Gastos' };

// Operaciones › Gastos: facturas de los proveedores de la plataforma, con la pestaña Total (en dólares) y una por proveedor
// (?prov=…), con el mismo formato que Marketing › Inversión (componente FacturasProveedor). Ningún proveedor deja pagar por
// API: el botón de pago abre la página de pagos de su consola.
//  - Google Workspace: flujo n8n F21 desde los correos de cobro de Google (trae pagos y cobros rechazados).
//  - AWS: Lambda tablero-facturas-aws con la API Invoicing (facturas); los pagos y cobros fallidos, de sus avisos por correo (F21).
//  - MongoDB Atlas: Lambda tablero-facturas-atlas con la API Admin v2 (estado, pagos y detalle en CSV; Atlas no da el PDF por API).
//  - Claude: una pestaña con sub-pestañas (proveedores con el mismo grupo). Claude Platform: flujo n8n F21 desde los recibos
//    de Anthropic (compras de créditos de la API, con la factura en PDF). Claude <persona>: su suscripción de claude.ai, con los
//    recibos que su cuenta reenvía a misha@wiptool.com (F21, PERSONAS); el histórico se trae una vez de claude.ai.
const PROVEEDORES: Proveedor[] = [
  { id: 'google-workspace', titulo: 'Google Workspace', pagar: 'https://admin.google.com/ac/billing/accounts', pagarTexto: 'Pagar en Google', pagos: true,
    fuente: 'Datos de los correos de cobro de Google que llegan a misha@wiptool.com; se revisan cada día a las 6:30 a. m. El total de cada factura se lee del PDF. El cobro es automático a la tarjeta registrada.' },
  { id: 'aws', titulo: 'AWS', pagar: 'https://us-east-1.console.aws.amazon.com/billing/home#/paymentsdashboard', pagarTexto: 'Pagar en AWS', pagos: true,
    fuente: 'Facturas de la cuenta de AWS 329792044951, leídas con la API de facturación de AWS cada día a las 7 a. m. Cada factura es el consumo del mes anterior y se cobra a la tarjeta registrada el día que se emite. AWS no informa los pagos por API: salen de sus avisos a info@aplicando.co (pago recibido o cobro fallido), revisados a las 6:30 a. m. Una factura está pagada si después hubo un pago y sin pagar si después solo hubo cobros fallidos; el cobro automático que sale bien no avisa.' },
  { id: 'mongodb', titulo: 'MongoDB Atlas', pagar: 'https://cloud.mongodb.com/v2#/org/62f2bbc72834d50bd9515f12/billing/overview', pagarTexto: 'Pagar en Atlas', pagos: true, enlaceTexto: 'Ver en Atlas',
    fuente: 'Facturas de la organización Aplicando en MongoDB Atlas, leídas con la API de Atlas cada día a las 7:15 a. m., con el estado de cada factura y de cada intento de cobro. Cada factura tiene su PDF y el detalle en CSV. Los PDF del histórico se trajeron una vez desde la web de Atlas; los nuevos llegan por correo a misha@wiptool.com. La factura del mes en curso aparece cuando Atlas la cierra.' },
  { id: 'claude-platform', grupo: 'Claude', titulo: 'Claude Platform', pagar: 'https://platform.claude.com/settings/billing', pagarTexto: 'Facturación en Claude',
    fuente: 'Compras de créditos de la API de Claude (Claude Platform), tomadas de los recibos de Anthropic que llegan a misha@wiptool.com; se revisan cada día a las 6:30 a. m. Cada recibo trae la factura en PDF. Los créditos se compran por adelantado: cada factura es una compra, no el consumo de un mes.' },
  { id: 'claude-misha', grupo: 'Claude', titulo: 'Claude Misha', pagar: 'https://claude.ai/settings/billing', pagarTexto: 'Facturación en Claude',
    fuente: 'Suscripción de claude.ai de Misha (cuenta mikfobe@gmail.com): plan Pro hasta el 28 de octubre de 2026 y Max desde entonces; se renueva cada mes. Las facturas anteriores se trajeron una vez de la facturación de claude.ai; las nuevas se leen cada día a las 6:30 a. m. de los recibos de Anthropic reenviados a misha@wiptool.com.' },
  { id: 'claude-jessica', grupo: 'Claude', titulo: 'Claude Jessica', proximo: true },
  { id: 'claude-johan', grupo: 'Claude', titulo: 'Claude Johan', proximo: true },
  { id: 'claude-luis', grupo: 'Claude', titulo: 'Claude Luis', proximo: true },
];

export default async function PaginaGastos({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  return <PaginaProveedores paginaId="gastos" proveedores={PROVEEDORES} prov={typeof sp.prov === 'string' ? sp.prov : undefined} monedaTotal="USD" />;
}
