import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Aviso, type Cifra } from '@/componentes/Bloques';
import { pedir, type Gastos } from '@/lib/datos';
import { fechaLarga, mesLargo } from '@/lib/formato';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { buscarPagina } from '@/lib/paginas';
import type { ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'Gastos' };

// Una pestaña por proveedor (?prov=…). Los PDF viven en el bucket privado "facturas" y se descargan con enlaces firmados
// de una hora. Ningún proveedor deja pagar por API: el botón de pago abre la página de pagos de su consola.
//  - Google Workspace: flujo n8n F21 desde los correos de cobro de Google (trae pagos y cobros rechazados).
//  - AWS: Lambda tablero-facturas-aws con la API Invoicing (solo facturas; AWS no informa pagos por API).
//  - MongoDB Atlas: Lambda tablero-facturas-atlas con la API Admin v2 (estado, pagos y detalle en CSV; Atlas no da el PDF por API).
interface Proveedor { id: string; titulo: string; pagar?: string; pagarTexto?: string; fuente?: string; pagos?: boolean; proximo?: boolean; enlaceTexto?: string }
const PROVEEDORES: Proveedor[] = [
  { id: 'google-workspace', titulo: 'Google Workspace', pagar: 'https://admin.google.com/ac/billing/accounts', pagarTexto: 'Pagar en Google', pagos: true,
    fuente: 'Datos de los correos de cobro de Google que llegan a misha@wiptool.com; se revisan cada día a las 6:30 a. m. El total de cada factura se lee del PDF. El cobro es automático a la tarjeta registrada.' },
  { id: 'aws', titulo: 'AWS', pagar: 'https://us-east-1.console.aws.amazon.com/billing/home#/paymentsdashboard', pagarTexto: 'Pagar en AWS',
    fuente: 'Facturas de la cuenta de AWS 329792044951, leídas con la API de facturación de AWS cada día a las 7 a. m. Cada factura es el consumo del mes anterior y se cobra a la tarjeta registrada el día que se emite. AWS no informa los pagos por API: para verlos o pagar a mano, usa el botón.' },
  { id: 'mongodb', titulo: 'MongoDB Atlas', pagar: 'https://cloud.mongodb.com/v2#/org/62f2bbc72834d50bd9515f12/billing/overview', pagarTexto: 'Pagar en Atlas', pagos: true, enlaceTexto: 'Ver en Atlas',
    fuente: 'Facturas de la organización Aplicando en MongoDB Atlas, leídas con la API de Atlas cada día a las 7:15 a. m., con el estado de cada factura y de cada intento de cobro. Atlas no entrega el PDF por API: se guarda el detalle de cada factura en CSV, y el PDF se baja con «Ver en Atlas». La factura del mes en curso aparece cuando Atlas la cierra.' },
];

const dosDecimales = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dinero = (v: number | null | undefined, moneda = 'USD') =>
  v == null ? '—' : `${moneda === 'USD' ? 'US$' : moneda} ${dosDecimales.format(v)}`;
const nombrePeriodo = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? mesLargo(p + '-01') : p);
// Estados de factura de Atlas.
const ESTADOS: Record<string, { texto: string; clase: string }> = {
  PAID: { texto: 'Pagada', clase: 'border-bueno/50 text-bueno' }, FAILED: { texto: 'Cobro fallido', clase: 'border-malo/50 text-malo' },
  PENDING: { texto: 'En curso', clase: 'border-linea text-suave' }, CLOSED: { texto: 'Por cobrar', clase: 'border-aviso text-aviso' },
  INVOICED: { texto: 'Facturada', clase: 'border-aviso text-aviso' }, FORGIVEN: { texto: 'Condonada', clase: 'border-linea text-suave' },
  FREE: { texto: 'Sin costo', clase: 'border-linea text-suave' }, PREPAID: { texto: 'Prepagada', clase: 'border-linea text-suave' },
};

const chip = (activo: boolean) =>
  `rounded-full border px-3 py-1 text-[13px] font-medium no-underline ${activo ? 'border-navy bg-navy text-white dark:border-lima dark:bg-lima dark:text-navy' : 'border-linea text-tinta hover:border-tenue'}`;
const boton = 'inline-flex items-center rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave no-underline hover:border-tenue hover:text-tinta';
const principal = 'shrink-0 rounded-lg bg-navy px-3 py-1.5 text-[13px] font-semibold text-white no-underline dark:bg-lima dark:text-navy';
const th = 'whitespace-nowrap border-b border-linea px-2 py-1.5 text-left text-xs font-medium text-suave';
const td = 'px-2 py-[7px]';

export default async function PaginaGastos({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  const prov = PROVEEDORES.find((p) => p.id === sp.prov) ?? PROVEEDORES[0];

  return (
    <>
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
        <div className="flex flex-col gap-3">
          <Encabezado pagina={buscarPagina('gastos')!} />
          <nav aria-label="Proveedor" className="flex flex-wrap gap-1.5">
            {PROVEEDORES.map((p) => (
              <Link key={p.id} href={`/gastos?prov=${p.id}`} aria-current={p.id === prov.id ? 'true' : undefined} className={chip(p.id === prov.id)}>
                {p.titulo}{p.proximo ? ' · pronto' : ''}
              </Link>
            ))}
          </nav>
        </div>
        {prov.pagar && <a href={prov.pagar} target="_blank" rel="noopener noreferrer" className={principal}>{prov.pagarTexto}</a>}
      </div>
      {prov.proximo ? <Aviso>Las facturas de {prov.titulo} se agregan en la siguiente etapa.</Aviso> : <Facturas prov={prov} />}
    </>
  );
}

async function Facturas({ prov }: { prov: Proveedor }) {
  const d = await pedir<Gastos>('tablero_gastos', { p_proveedor: prov.id });
  const k = d.kpis;
  const conPeriodo = d.facturas.some((f) => f.periodo);
  const conEstado = d.facturas.some((f) => f.estado);
  const columnas = 5 + (conPeriodo ? 1 : 0) + (conEstado ? 1 : 0);

  // Enlaces firmados (1 hora) para ver y descargar cada PDF; solo el equipo puede pedirlos (reglas del bucket).
  const enlaces = new Map<string, string>();
  const rutas = d.facturas.map((f) => f.archivo).filter(Boolean);
  if (!MODO_EJEMPLO && rutas.length) {
    const { data } = await (await clienteServidor()).storage.from('facturas').createSignedUrls(rutas, 3600);
    for (const e of data ?? []) if (e.path && e.signedUrl) enlaces.set(e.path, e.signedUrl);
  }

  const cifras: Cifra[] = prov.pagos ? [
    { etiqueta: 'Último pago recibido', valor: k.ultimo_pago_monto, formato: (v) => dinero(v), principal: true,
      nota: k.ultimo_pago ? fechaLarga(k.ultimo_pago) : 'Sin pagos registrados' },
    { etiqueta: 'Pagado en 12 meses', valor: k.pagado_12m, formato: (v) => dinero(v) },
    { etiqueta: 'Facturado en 12 meses', valor: k.facturado_12m, formato: (v) => dinero(v) },
    { etiqueta: 'Facturas después del último pago', valor: k.facturas_sin_pago, nota: 'Emitidas sin un pago recibido posterior' },
  ] : [
    { etiqueta: `Última factura${k.ultima_factura_periodo ? ` (${nombrePeriodo(String(k.ultima_factura_periodo))})` : ''}`,
      valor: k.ultima_factura_monto, anterior: k.penultima_factura_monto, formato: (v) => dinero(v), principal: true, menorEsMejor: true },
    { etiqueta: 'Facturado en 12 meses', valor: k.facturado_12m, formato: (v) => dinero(v) },
    { etiqueta: 'Promedio mensual (12 meses)', valor: k.promedio_12m, formato: (v) => dinero(v) },
    { etiqueta: 'Facturas', valor: k.facturas, nota: k.ultima_factura ? `La última, emitida el ${fechaLarga(k.ultima_factura)}` : undefined },
  ];

  return (
    <>
      {prov.pagos && Number(k.rechazos_sin_pago) > 0 && (
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-l-4 border-linea border-l-malo bg-superficie px-3.5 py-3 text-[13px] md:flex-row md:items-center md:justify-between">
          <span>
            <strong className="font-semibold">Hay {k.rechazos_sin_pago} {Number(k.rechazos_sin_pago) === 1 ? 'cobro rechazado' : 'cobros rechazados'} después del último pago</strong>
            {k.ultimo_pago ? <> ({fechaLarga(k.ultimo_pago)})</> : null}. El último rechazo fue el {k.ultimo_rechazo ? fechaLarga(k.ultimo_rechazo) : '—'}.
            Revisa la tarjeta y paga el saldo para que no se suspenda el servicio.
          </span>
          {prov.pagar && <a href={prov.pagar} target="_blank" rel="noopener noreferrer" className={principal}>{prov.pagarTexto}</a>}
        </div>
      )}
      <Cifras items={cifras} />
      {prov.fuente && <Aviso>{prov.fuente}</Aviso>}
      <Rejilla>
        <Tarjeta titulo="Facturas" nota={`${d.facturas.length} facturas`}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Fecha</th>{conPeriodo && <th className={th}>Consumo de</th>}<th className={th}>Cuenta</th><th className={th}>Número</th>
                  <th className={`${th} text-right`}>Total</th>{conEstado && <th className={th}>Estado</th>}<th className={th}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {d.facturas.length ? d.facturas.map((f) => {
                  const url = enlaces.get(f.archivo);
                  return (
                    <tr key={f.id} className="border-b border-reja last:border-0">
                      <td className={`${td} whitespace-nowrap`}>{fechaLarga(f.fecha)}</td>
                      {conPeriodo && <td className={`${td} whitespace-nowrap`}>{f.periodo ? nombrePeriodo(f.periodo) : ''}</td>}
                      <td className={td}>{f.cuenta}</td>
                      <td className={`${td} tabular-nums`}>{f.numero}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{dinero(f.monto, f.moneda)}</td>
                      {conEstado && (
                        <td className={td}>{f.estado && (
                          <span className={`rounded-full border px-2 py-0.5 text-[12px] ${(ESTADOS[f.estado] ?? ESTADOS.PENDING).clase}`}>{ESTADOS[f.estado]?.texto ?? f.estado}</span>
                        )}</td>
                      )}
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <span className="inline-flex gap-1.5">
                          {url && f.archivo.endsWith('.csv') ? (
                            <a className={boton} href={`${url}&download=${encodeURIComponent(`${prov.titulo} ${f.periodo || f.numero}.csv`)}`}>Detalle CSV</a>
                          ) : url ? (
                            <>
                              <a className={boton} href={url} target="_blank" rel="noopener noreferrer">Ver</a>
                              <a className={boton} href={`${url}&download=${encodeURIComponent(`${prov.titulo} ${f.numero}.pdf`)}`}>Descargar</a>
                            </>
                          ) : <span className="text-tenue">PDF pendiente</span>}
                          {f.correo_url && <a className={boton} href={f.correo_url} target="_blank" rel="noopener noreferrer">{prov.enlaceTexto ?? 'Correo'}</a>}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={columnas} className="px-2 py-5 text-center text-tenue">Aún no hay facturas cargadas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Tarjeta>
        {prov.pagos && (
          <Tarjeta titulo="Pagos y cobros rechazados">
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={th}>Fecha</th><th className={th}>Cuenta</th><th className={th}>Movimiento</th>
                    <th className={`${th} text-right`}>Monto</th><th className={th}>Detalle</th><th className={th}><span className="sr-only">Correo</span></th>
                  </tr>
                </thead>
                <tbody>
                  {d.movimientos.length ? d.movimientos.map((m, i) => (
                    <tr key={i} className="border-b border-reja last:border-0">
                      <td className={`${td} whitespace-nowrap`}>{fechaLarga(m.fecha)}</td>
                      <td className={td}>{m.cuenta}</td>
                      <td className={td}>
                        <span className={`rounded-full border px-2 py-0.5 text-[12px] ${m.tipo === 'pago' ? 'border-bueno/50 text-bueno' : 'border-malo/50 text-malo'}`}>
                          {m.tipo === 'pago' ? 'Pago recibido' : 'Cobro rechazado'}
                        </span>
                      </td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{dinero(m.monto, m.moneda)}</td>
                      <td className={td}>{m.detalle}</td>
                      <td className={`${td} text-right`}>{m.correo_url && <a className={boton} href={m.correo_url} target="_blank" rel="noopener noreferrer">Correo</a>}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} className="px-2 py-5 text-center text-tenue">Aún no hay pagos registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        )}
      </Rejilla>
    </>
  );
}
