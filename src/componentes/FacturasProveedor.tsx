import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Aviso, type Cifra } from '@/componentes/Bloques';
import { pedir, type Gastos, type FacturaProveedor } from '@/lib/datos';
import { fechaLarga, mesLargo } from '@/lib/formato';
import { buscarPagina } from '@/lib/paginas';
import { hoyBogota } from '@/lib/rango';

// Marketing › Inversión: una pestaña por proveedor (?prov=…), con la función tablero_gastos y la tabla proveedor_factura
// de Operaciones › Gastos. Por ahora solo el modo 'cobros': cobros a la tarjeta (Meta Ads), con el total por mes y el
// enlace al recibo en la consola del proveedor. Los proveedores con factura en PDF usarán la tabla de gastos/page.tsx.
export interface Proveedor {
  id: string; titulo: string; pagar?: string; pagarTexto?: string; fuente?: string; pagos?: boolean; proximo?: boolean;
  modo?: 'cobros';
  recibo?: (f: FacturaProveedor) => string; // enlace al recibo en la consola del proveedor
}

const dosDecimales = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const dinero = (v: number | null | undefined, moneda = 'USD') =>
  v == null ? '—' : moneda === 'COP' ? `$${pesos.format(v)}` : `${moneda === 'USD' ? 'US$' : moneda} ${dosDecimales.format(v)}`;
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
  const k = d.kpis;
  const moneda = d.facturas[0]?.moneda ?? 'COP';
  const hoy = hoyBogota();
  const hace12 = new Date(Date.parse(hoy) - 365 * 86400e3).toISOString().slice(0, 10);
  const ultimos12 = d.facturas.filter((f) => f.fecha > hace12);

  // Total por mes de los últimos 12 meses (los meses sin cobros quedan en cero).
  const porMes = new Map<string, { total: number; cobros: number }>();
  const [anio, mes] = hoy.split('-').map(Number);
  for (let i = 0; i < 12; i++) porMes.set(new Date(Date.UTC(anio, mes - 1 - i, 1)).toISOString().slice(0, 7), { total: 0, cobros: 0 });
  for (const f of d.facturas) {
    const m = porMes.get(f.fecha.slice(0, 7));
    if (m) { m.total += Number(f.monto ?? 0); m.cobros += 1; }
  }
  const mayor = Math.max(1, ...[...porMes.values()].map((m) => m.total));

  const cifras: Cifra[] = [
    { etiqueta: 'Último cobro', valor: k.ultima_factura_monto, anterior: k.penultima_factura_monto, formato: (v) => dinero(v, moneda), principal: true,
      menorEsMejor: true, nota: k.ultima_factura ? fechaLarga(k.ultima_factura) : 'Sin cobros registrados' },
    { etiqueta: 'Cobrado en 12 meses', valor: k.facturado_12m, formato: (v) => dinero(v, moneda) },
    { etiqueta: 'Promedio por mes (12 meses)', valor: k.facturado_12m == null ? null : Number(k.facturado_12m) / 12, formato: (v) => dinero(v, moneda) },
    { etiqueta: 'Cobros en 12 meses', valor: ultimos12.length, nota: `${k.facturas} desde el inicio` },
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
        <Tarjeta titulo="Cobros y recibos" nota={`${d.facturas.length} cobros`} col={8}>
          <div className="-mx-1 max-h-[560px] overflow-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead className="sticky top-0 bg-superficie">
                <tr>
                  <th className={th}>Fecha</th><th className={th}>Cuenta</th><th className={th}>Transacción</th>
                  <th className={`${th} text-right`}>Cobrado</th><th className={th}><span className="sr-only">Recibo</span></th>
                </tr>
              </thead>
              <tbody>
                {d.facturas.length ? d.facturas.map((f) => (
                  <tr key={f.id} className="border-b border-reja last:border-0">
                    <td className={`${td} whitespace-nowrap`}>{fechaLarga(f.fecha)}</td>
                    <td className={td}>{f.cuenta}</td>
                    <td className={`${td} tabular-nums text-suave`}>{f.numero}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{dinero(f.monto, f.moneda)}</td>
                    <td className={`${td} whitespace-nowrap text-right`}>
                      {prov.recibo && <a className={boton} href={prov.recibo(f)} target="_blank" rel="noopener noreferrer">Recibo PDF</a>}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="px-2 py-5 text-center text-tenue">Aún no hay cobros cargados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      </Rejilla>
    </>
  );
}
