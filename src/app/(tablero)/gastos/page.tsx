import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Aviso } from '@/componentes/Bloques';
import { pedir, type Gastos } from '@/lib/datos';
import { fechaLarga } from '@/lib/formato';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { buscarPagina } from '@/lib/paginas';
import type { ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'Gastos' };

// Una pestaña por proveedor (?prov=…). Las facturas de Google Workspace las carga el flujo n8n F21 desde los correos de
// cobro de Google; los PDF viven en el bucket privado "facturas" y se descargan con enlaces firmados de una hora.
// Google no deja pagar Workspace por API: "Pagar en Google" abre la cuenta de pagos en la consola de administración.
const PROVEEDORES = [
  { id: 'google-workspace', titulo: 'Google Workspace', pagar: 'https://admin.google.com/ac/billing/accounts' },
  { id: 'aws', titulo: 'AWS', proximo: true },
  { id: 'mongodb', titulo: 'MongoDB Atlas', proximo: true },
] as const;

const dosDecimales = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dinero = (v: number | null | undefined, moneda = 'USD') =>
  v == null ? '—' : `${moneda === 'USD' ? 'US$' : moneda} ${dosDecimales.format(v)}`;

const chip = (activo: boolean) =>
  `rounded-full border px-3 py-1 text-[13px] font-medium no-underline ${activo ? 'border-navy bg-navy text-white dark:border-lima dark:bg-lima dark:text-navy' : 'border-linea text-tinta hover:border-tenue'}`;
const boton = 'inline-flex items-center rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave no-underline hover:border-tenue hover:text-tinta';
const th = 'whitespace-nowrap border-b border-linea px-2 py-1.5 text-left text-xs font-medium text-suave';
const td = 'px-2 py-[7px]';

export default async function PaginaGastos({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  const prov = PROVEEDORES.find((p) => p.id === sp.prov) ?? PROVEEDORES[0];

  return (
    <>
      <div className="flex flex-col gap-3">
        <Encabezado pagina={buscarPagina('gastos')!} />
        <nav aria-label="Proveedor" className="flex flex-wrap gap-1.5">
          {PROVEEDORES.map((p) => (
            <Link key={p.id} href={`/gastos?prov=${p.id}`} aria-current={p.id === prov.id ? 'true' : undefined} className={chip(p.id === prov.id)}>
              {p.titulo}{'proximo' in p && p.proximo ? ' · pronto' : ''}
            </Link>
          ))}
        </nav>
      </div>
      {'proximo' in prov && prov.proximo
        ? <Aviso>Las facturas de {prov.titulo} se agregan en la siguiente etapa.</Aviso>
        : <Proveedor id={prov.id} titulo={prov.titulo} pagar={'pagar' in prov ? prov.pagar : ''} />}
    </>
  );
}

async function Proveedor({ id, titulo, pagar }: { id: string; titulo: string; pagar: string }) {
  const d = await pedir<Gastos>('tablero_gastos', { p_proveedor: id });
  const k = d.kpis;

  // Enlaces firmados (1 hora) para ver y descargar cada PDF; solo el equipo puede pedirlos (reglas del bucket).
  const enlaces = new Map<string, string>();
  const rutas = d.facturas.map((f) => f.archivo).filter(Boolean);
  if (!MODO_EJEMPLO && rutas.length) {
    const { data } = await (await clienteServidor()).storage.from('facturas').createSignedUrls(rutas, 3600);
    for (const e of data ?? []) if (e.path && e.signedUrl) enlaces.set(e.path, e.signedUrl);
  }

  return (
    <>
      {Number(k.rechazos_sin_pago) > 0 && (
        <div className="flex flex-col gap-2.5 rounded-[10px] border border-l-4 border-linea border-l-malo bg-superficie px-3.5 py-3 text-[13px] md:flex-row md:items-center md:justify-between">
          <span>
            <strong className="font-semibold">Hay {k.rechazos_sin_pago} {Number(k.rechazos_sin_pago) === 1 ? 'cobro rechazado' : 'cobros rechazados'} después del último pago</strong>
            {k.ultimo_pago ? <> ({fechaLarga(k.ultimo_pago)})</> : null}. El último rechazo fue el {k.ultimo_rechazo ? fechaLarga(k.ultimo_rechazo) : '—'}.
            Revisa la tarjeta y paga el saldo en Google para que no se suspenda el servicio.
          </span>
          {pagar && <a href={pagar} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-navy px-3 py-1.5 font-semibold text-white no-underline dark:bg-lima dark:text-navy">Pagar en Google</a>}
        </div>
      )}
      <Cifras items={[
        { etiqueta: 'Último pago recibido', valor: k.ultimo_pago_monto, formato: (v) => dinero(v), principal: true,
          nota: k.ultimo_pago ? fechaLarga(k.ultimo_pago) : 'Sin pagos registrados' },
        { etiqueta: 'Pagado en 12 meses', valor: k.pagado_12m, formato: (v) => dinero(v) },
        { etiqueta: 'Facturado en 12 meses', valor: k.facturado_12m, formato: (v) => dinero(v) },
        { etiqueta: 'Facturas después del último pago', valor: k.facturas_sin_pago, nota: 'Emitidas sin un pago recibido posterior' },
      ]} />
      <Aviso>
        Datos de los correos de cobro de Google ({titulo}) que llegan a misha@wiptool.com; se revisan cada día a las 6:30 a. m.
        El total de cada factura se lee del PDF. El cobro es automático a la tarjeta registrada; para pagar a mano o cambiar la tarjeta:
        {pagar && <> <a className="enlace-tabla" href={pagar} target="_blank" rel="noopener noreferrer">consola de administración → Facturación</a>.</>}
      </Aviso>
      <Rejilla>
        <Tarjeta titulo="Facturas" nota={`${d.facturas.length} facturas`}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Fecha</th><th className={th}>Cuenta</th><th className={th}>Número</th>
                  <th className={`${th} text-right`}>Total</th><th className={th}><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {d.facturas.length ? d.facturas.map((f) => {
                  const url = enlaces.get(f.archivo);
                  return (
                    <tr key={f.id} className="border-b border-reja last:border-0">
                      <td className={`${td} whitespace-nowrap`}>{fechaLarga(f.fecha)}</td>
                      <td className={td}>{f.cuenta}</td>
                      <td className={`${td} tabular-nums`}>{f.numero}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{dinero(f.monto, f.moneda)}</td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <span className="inline-flex gap-1.5">
                          {url ? (
                            <>
                              <a className={boton} href={url} target="_blank" rel="noopener noreferrer">Ver</a>
                              <a className={boton} href={`${url}&download=${encodeURIComponent(`${titulo} ${f.numero}.pdf`)}`}>Descargar</a>
                            </>
                          ) : <span className="text-tenue">PDF no disponible</span>}
                          {f.correo_url && <a className={boton} href={f.correo_url} target="_blank" rel="noopener noreferrer">Correo</a>}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={5} className="px-2 py-5 text-center text-tenue">Aún no hay facturas cargadas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Tarjeta>
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
      </Rejilla>
    </>
  );
}
