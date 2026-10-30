import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Aviso, type Cifra } from '@/componentes/Bloques';
import { pedir, type Gastos, type FacturaProveedor } from '@/lib/datos';
import { fechaLarga, mesLargo } from '@/lib/formato';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { buscarPagina } from '@/lib/paginas';
import { hoyBogota } from '@/lib/rango';

// Marketing › Inversión: una pestaña por proveedor (?prov=…), con la función tablero_gastos y la tabla proveedor_factura
// de Operaciones › Gastos. Por ahora solo el modo 'cobros': cobros a la tarjeta (Meta Ads), con el total por mes y el
// enlace al recibo en la consola del proveedor. Los proveedores con factura en PDF usarán la tabla de gastos/page.tsx.
export interface Proveedor {
  id: string; titulo: string; pagar?: string; pagarTexto?: string; fuente?: string; pagos?: boolean; proximo?: boolean;
  modo?: 'cobros';
  recibo?: (f: FacturaProveedor) => string; // enlace al recibo en la consola del proveedor
  // Palabras de la pestaña: cobro/cobros, columna del número, botón del recibo, cifra principal y título de la tabla
  // (Meta: cobro, Transacción, Recibo PDF, «Último cobro», «Cobros y recibos»). «enlace»: texto del botón cuando no hay PDF
  // guardado y el botón lleva a la consola del proveedor (si no se da, se usa «recibo»).
  palabras?: { cobro: string; cobros: string; numero: string; recibo: string; ultimo?: string; tabla?: string; enlace?: string };
}
const PALABRAS = { cobro: 'cobro', cobros: 'cobros', numero: 'Transacción', recibo: 'Recibo PDF' };
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
// Facturas que el proveedor emitió pero no cobró (Brevo «Written off» o sin pagar): se listan, pero no suman en las cifras.
const NO_COBRADA: Record<string, string> = { WRITTEN_OFF: 'No se cobró', UNPAID: 'Sin pagar' };

const dosDecimales = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const dinero = (v: number | null | undefined, moneda = 'USD') =>
  v == null ? '—' : moneda === 'COP' ? `$${pesos.format(v)}` : `${({ USD: 'US$', EUR: '€' } as Record<string, string>)[moneda] ?? moneda} ${dosDecimales.format(v)}`;
const nombrePeriodo = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? mesLargo(p + '-01') : p);

const chip = (activo: boolean) =>
  `rounded-full border px-3 py-1 text-[13px] font-medium no-underline ${activo ? 'border-navy bg-navy text-white dark:border-lima dark:bg-lima dark:text-navy' : 'border-linea text-tinta hover:border-tenue'}`;
const boton = 'inline-flex items-center rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave no-underline hover:border-tenue hover:text-tinta';
const principal = 'shrink-0 rounded-lg bg-navy px-3 py-1.5 text-[13px] font-semibold text-white no-underline dark:bg-lima dark:text-navy';
const th = 'whitespace-nowrap border-b border-linea px-2 py-1.5 text-left text-xs font-medium text-suave';
const td = 'px-2 py-[7px]';

export function PaginaProveedores({ paginaId, proveedores, prov: elegido }: { paginaId: string; proveedores: Proveedor[]; prov?: string }) {
  const prov = proveedores.find((p) => p.id === elegido) ?? proveedores[0];
  return (
    <>
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
        <div className="flex flex-col gap-3">
          <Encabezado pagina={buscarPagina(paginaId)!} />
          <nav aria-label="Proveedor" className="flex flex-wrap gap-1.5">
            {proveedores.map((p) => (
              <Link key={p.id} href={`/${paginaId}?prov=${p.id}`} aria-current={p.id === prov.id ? 'true' : undefined} className={chip(p.id === prov.id)}>
                {p.titulo}{p.proximo ? ' · pronto' : ''}
              </Link>
            ))}
          </nav>
        </div>
        {prov.pagar && <a href={prov.pagar} target="_blank" rel="noopener noreferrer" className={principal}>{prov.pagarTexto}</a>}
      </div>
      {prov.modo === 'cobros' && !prov.proximo ? <Cobros prov={prov} /> : <Aviso>Las facturas de {prov.titulo} se agregan en la siguiente etapa.</Aviso>}
    </>
  );
}

// Cobros a la tarjeta, sin factura propia (Meta Ads): total por mes y enlace al recibo en la consola del proveedor.
async function Cobros({ prov }: { prov: Proveedor }) {
  const d = await pedir<Gastos>('tablero_gastos', { p_proveedor: prov.id });
  const p: NonNullable<Proveedor['palabras']> = prov.palabras ?? PALABRAS;
  const moneda = d.facturas[0]?.moneda ?? 'COP';
  const hoy = hoyBogota();
  const hace12 = new Date(Date.parse(hoy) - 365 * 86400e3).toISOString().slice(0, 10);
  // Las cifras salen de las facturas cobradas (tablero_gastos cuenta todo menos PENDING, también las que no se cobraron).
  const cobradas = d.facturas.filter((f) => !NO_COBRADA[f.estado]);
  const ultimos12 = cobradas.filter((f) => f.fecha > hace12);
  const cobrado12 = ultimos12.length ? ultimos12.reduce((s, f) => s + Number(f.monto ?? 0), 0) : null;
  const [ultima, penultima] = cobradas;

  // Total por mes de los últimos 12 meses (los meses sin cobros quedan en cero).
  const porMes = new Map<string, { total: number; cobros: number }>();
  const [anio, mes] = hoy.split('-').map(Number);
  for (let i = 0; i < 12; i++) porMes.set(new Date(Date.UTC(anio, mes - 1 - i, 1)).toISOString().slice(0, 7), { total: 0, cobros: 0 });
  for (const f of cobradas) {
    const m = porMes.get(f.fecha.slice(0, 7));
    if (m) { m.total += Number(f.monto ?? 0); m.cobros += 1; }
  }
  const mayor = Math.max(1, ...[...porMes.values()].map((m) => m.total));

  // PDF guardado en el bucket privado "facturas" (Brevo): enlace firmado de 1 hora, sin depender de la sesión del proveedor.
  const enlaces = new Map<string, string>();
  const rutas = d.facturas.map((f) => f.archivo).filter(Boolean);
  if (!MODO_EJEMPLO && rutas.length) {
    const { data } = await (await clienteServidor()).storage.from('facturas').createSignedUrls(rutas, 3600);
    for (const e of data ?? []) if (e.path && e.signedUrl) enlaces.set(e.path, e.signedUrl);
  }

  const cifras: Cifra[] = [
    { etiqueta: p.ultimo ?? `Último ${p.cobro}`, valor: ultima?.monto ?? null, anterior: penultima?.monto ?? null, formato: (v) => dinero(v, moneda), principal: true,
      menorEsMejor: true, nota: ultima ? fechaLarga(ultima.fecha) : `Sin ${p.cobros} todavía` },
    { etiqueta: 'Cobrado en 12 meses', valor: cobrado12, formato: (v) => dinero(v, moneda) },
    { etiqueta: 'Promedio por mes (12 meses)', valor: cobrado12 == null ? null : cobrado12 / 12, formato: (v) => dinero(v, moneda) },
    { etiqueta: `${mayuscula(p.cobros)} en 12 meses`, valor: ultimos12.length, nota: `${cobradas.length} desde el inicio` },
  ];

  return (
    <>
      <Cifras items={cifras} />
      {prov.fuente && <Aviso>{prov.fuente}</Aviso>}
      <Rejilla>
        <Tarjeta titulo="Cobrado por mes" nota="Últimos 12 meses" col={4}>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {[...porMes.entries()].map(([mes, m]) => (
                <tr key={mes} className="border-b border-reja last:border-0">
                  <td className={`${td} whitespace-nowrap`}>{nombrePeriodo(mes).replace(/^./, (l) => l.toUpperCase())}</td>
                  <td className={`${td} w-full`}>
                    <span className="block h-2 rounded-full bg-lima" style={{ width: `${(m.total / mayor) * 100}%` }} aria-hidden />
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{m.total ? dinero(m.total, moneda) : '—'}</td>
                  <td className={`${td} whitespace-nowrap text-right text-suave tabular-nums`}>{m.cobros || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
        <Tarjeta titulo={p.tabla ?? `${mayuscula(p.cobros)} y recibos`} nota={`${d.facturas.length} ${d.facturas.length === 1 ? p.cobro : p.cobros}`} col={8}>
          <div className="-mx-1 max-h-[560px] overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-superficie">
                <tr>
                  <th className={th}>Fecha</th><th className={th}>Cuenta</th><th className={th}>{p.numero}</th>
                  <th className={`${th} text-right`}>Cobrado</th><th className={th}><span className="sr-only">Recibo</span></th>
                </tr>
              </thead>
              <tbody>
                {d.facturas.length ? d.facturas.map((f) => (
                  <tr key={f.id} className="border-b border-reja last:border-0">
                    <td className={`${td} whitespace-nowrap`}>{fechaLarga(f.fecha)}</td>
                    <td className={td}>{f.cuenta}</td>
                    <td className={`${td} tabular-nums text-suave`}>{f.numero || '—'}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                      {NO_COBRADA[f.estado] ? (
                        <><span className="mr-1.5 rounded-full border border-linea px-2 py-0.5 text-[11.5px] text-suave">{NO_COBRADA[f.estado]}</span>
                          <s className="text-tenue">{dinero(f.monto, f.moneda)}</s></>
                      ) : dinero(f.monto, f.moneda)}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {enlaces.get(f.archivo)
                        ? <a className={boton} href={enlaces.get(f.archivo)} target="_blank" rel="noopener noreferrer">{p.recibo}</a>
                        : prov.recibo && <a className={boton} href={prov.recibo(f)} target="_blank" rel="noopener noreferrer">{p.enlace ?? p.recibo}</a>}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-2 py-5 text-center text-tenue">Aún no hay {p.cobros}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </Rejilla>
    </>
  );
}
