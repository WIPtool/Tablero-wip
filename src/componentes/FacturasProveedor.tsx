import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Aviso, type Cifra } from '@/componentes/Bloques';
import { pedir, type Gastos, type FacturaProveedor, type GastosKpis, type MovimientoProveedor } from '@/lib/datos';
import { fechaLarga, mesLargo } from '@/lib/formato';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { buscarPagina } from '@/lib/paginas';
import { hoyBogota } from '@/lib/rango';

// Facturas y cobros de proveedores con el mismo formato en Operaciones › Gastos y Marketing › Inversión, con la función
// tablero_gastos y la tabla proveedor_factura. La primera pestaña es el Total de todos los proveedores de la página en una
// sola moneda (Gastos en dólares; Inversión en pesos con la TRM del día de cada cobro). Cada proveedor (?prov=…) tiene las
// mismas cifras, el total por mes y la tabla Fecha · (Consumo de) · Cuenta · Número · Total · Estado. El PDF guardado en el
// bucket privado "facturas" se ve y se descarga con enlaces firmados de una hora; sin PDF, el botón lleva al recibo en la
// consola del proveedor. Los proveedores con el mismo grupo (Claude) van en una pestaña con sub-pestañas.
export interface Proveedor {
  id: string; titulo: string; grupo?: string; pagar?: string; pagarTexto?: string; fuente?: string; proximo?: boolean;
  pagos?: boolean;          // trae pagos y cobros rechazados (proveedor_movimiento): Google Workspace, MongoDB Atlas
  enlaceTexto?: string;     // botón al correo o a la página de la factura (correo_url); «Correo» si no se da
  recibo?: (f: FacturaProveedor) => string; // enlace al recibo en la consola del proveedor cuando no hay PDF guardado
  // Palabras de la pestaña: cobro/cobros, columna del número, botón del recibo, cifra principal y título de la tabla.
  // «enlace»: texto del botón del recibo en la consola (si no se da, se usa «recibo»).
  palabras?: { cobro: string; cobros: string; numero: string; recibo: string; ultimo?: string; tabla?: string; enlace?: string };
}
type Palabras = NonNullable<Proveedor['palabras']>;
const PALABRAS: Palabras = { cobro: 'factura', cobros: 'facturas', numero: 'Número', recibo: 'Recibo', ultimo: 'Última factura', tabla: 'Facturas' };
const palabrasDe = (prov: Proveedor): Palabras => (prov.palabras ? { ...PALABRAS, ultimo: undefined, tabla: undefined, ...prov.palabras } : PALABRAS);
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Estados de factura (Atlas, Brevo, recibos pagados). Las que el proveedor emitió pero no cobró se listan y no suman.
const ESTADOS: Record<string, { texto: string; clase: string; noSuma?: boolean }> = {
  PAID: { texto: 'Pagada', clase: 'border-bueno/50 text-bueno' }, FAILED: { texto: 'Cobro fallido', clase: 'border-malo/50 text-malo' },
  PENDING: { texto: 'En curso', clase: 'border-linea text-suave' }, CLOSED: { texto: 'Por cobrar', clase: 'border-aviso text-aviso' },
  INVOICED: { texto: 'Facturada', clase: 'border-aviso text-aviso' }, FORGIVEN: { texto: 'Condonada', clase: 'border-linea text-suave' },
  FREE: { texto: 'Sin costo', clase: 'border-linea text-suave' }, PREPAID: { texto: 'Prepagada', clase: 'border-linea text-suave' },
  WRITTEN_OFF: { texto: 'No se cobró', clase: 'border-linea text-suave', noSuma: true }, UNPAID: { texto: 'Sin pagar', clase: 'border-malo/50 text-malo', noSuma: true },
  SIN_PAGAR: { texto: 'Sin pagar', clase: 'border-malo/50 text-malo' }, // deducido de los pagos y cobros fallidos; se debe, así que suma
};
const suma = (f: FacturaProveedor) => !ESTADOS[f.estado]?.noSuma;

// Estado de pago de las facturas que no lo traen (Google Workspace, AWS), con los pagos y cobros fallidos del proveedor:
// pagada si es anterior al último pago; sin pagar si después del último pago hubo un cobro fallido (desde 5 días antes de la
// factura, porque el intento de cobro puede llegar antes que ella); si no, se da por cobrada (el cobro automático no avisa).
function estadosDePago(d: Gastos, prov: Proveedor): FacturaProveedor[] {
  if (!prov.pagos) return d.facturas;
  const ultimoPago = d.movimientos.filter((m) => m.tipo === 'pago').reduce((u, m) => (m.fecha > u ? m.fecha : u), '');
  const rechazos = d.movimientos.filter((m) => m.tipo === 'rechazo' && m.fecha > ultimoPago).map((m) => m.fecha);
  return d.facturas.map((f) => (f.estado ? f : {
    ...f, estado: f.fecha > ultimoPago && rechazos.some((r) => r >= restarDias(f.fecha, 5)) ? 'SIN_PAGAR' : 'PAID',
  }));
}

const dosDecimales = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const dinero = (v: number | null | undefined, moneda = 'USD') =>
  v == null ? '—' : moneda === 'COP' ? `$${pesos.format(v)}` : `${({ USD: 'US$', EUR: '€' } as Record<string, string>)[moneda] ?? moneda} ${dosDecimales.format(v)}`;
const NOMBRE_MONEDA: Record<string, string> = { USD: 'dólares', COP: 'pesos', EUR: 'euros' };
const nombrePeriodo = (p: string) => (/^\d{4}-\d{2}$/.test(p) ? mesLargo(p + '-01') : p);
const restarDias = (fecha: string, dias: number) => new Date(Date.parse(fecha) - dias * 86400e3).toISOString().slice(0, 10);

const chip = (activo: boolean) =>
  `rounded-full border px-3 py-1 text-[13px] font-medium no-underline ${activo ? 'border-navy bg-navy text-white dark:border-lima dark:bg-lima dark:text-navy' : 'border-linea text-tinta hover:border-tenue'}`;
const subchip = (activo: boolean) =>
  `rounded-full border px-2.5 py-0.5 text-[12.5px] no-underline ${activo ? 'border-navy font-medium text-navy dark:border-lima dark:text-lima' : 'border-linea text-suave hover:border-tenue hover:text-tinta'}`;
const boton = 'inline-flex items-center rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave no-underline hover:border-tenue hover:text-tinta';
const principal = 'shrink-0 rounded-lg bg-navy px-3 py-1.5 text-[13px] font-semibold text-white no-underline dark:bg-lima dark:text-navy';
const th = 'whitespace-nowrap border-b border-linea px-2 py-1.5 text-left text-xs font-medium text-suave';
const td = 'px-2 py-[7px]';

export function PaginaProveedores({ paginaId, proveedores, prov: elegido, monedaTotal }: {
  paginaId: string; proveedores: Proveedor[]; prov?: string; monedaTotal: 'USD' | 'COP';
}) {
  const prov = proveedores.find((p) => p.id === elegido); // sin ?prov (o ?prov=total) se abre el Total
  // Pestañas de arriba: Total, cada proveedor, o su grupo (Claude), que abre la primera sub-pestaña del grupo.
  const pestanas = proveedores.filter((p, i) => !p.grupo || proveedores.findIndex((q) => q.grupo === p.grupo) === i);
  const subpestanas = prov?.grupo ? proveedores.filter((p) => p.grupo === prov.grupo) : [];
  return (
    <>
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
        <div className="flex flex-col gap-3">
          <Encabezado pagina={buscarPagina(paginaId)!} />
          <nav aria-label="Proveedor" className="flex flex-wrap gap-1.5">
            <Link href={`/${paginaId}?prov=total`} aria-current={!prov ? 'true' : undefined} className={chip(!prov)}>Total</Link>
            {pestanas.map((p) => {
              const activo = p.grupo ? p.grupo === prov?.grupo : p.id === prov?.id;
              return (
                <Link key={p.id} href={`/${paginaId}?prov=${p.id}`} aria-current={activo ? 'true' : undefined} className={chip(activo)}>
                  {p.grupo ?? p.titulo}{!p.grupo && p.proximo ? ' · pronto' : ''}
                </Link>
              );
            })}
          </nav>
          {subpestanas.length > 0 && (
            <nav aria-label={prov?.grupo} className="flex flex-wrap gap-1.5">
              {subpestanas.map((p) => (
                <Link key={p.id} href={`/${paginaId}?prov=${p.id}`} aria-current={p.id === prov?.id ? 'true' : undefined} className={subchip(p.id === prov?.id)}>
                  {p.titulo}{p.proximo ? ' · pronto' : ''}
                </Link>
              ))}
            </nav>
          )}
        </div>
        {prov?.pagar && <a href={prov.pagar} target="_blank" rel="noopener noreferrer" className={principal}>{prov.pagarTexto}</a>}
      </div>
      {!prov ? <Total paginaId={paginaId} proveedores={proveedores} moneda={monedaTotal} />
        : prov.proximo ? <Aviso>Las facturas de {prov.titulo} se agregan en la siguiente etapa.</Aviso>
          : <Facturas prov={prov} />}
    </>
  );
}

// Los últimos 12 meses (del actual hacia atrás), en cero.
function meses12(hoy: string) {
  const [anio, mes] = hoy.split('-').map(Number);
  const m = new Map<string, { total: number; cobros: number }>();
  for (let i = 0; i < 12; i++) m.set(new Date(Date.UTC(anio, mes - 1 - i, 1)).toISOString().slice(0, 7), { total: 0, cobros: 0 });
  return m;
}

// Enlaces firmados (1 hora) del bucket privado "facturas"; solo el equipo puede pedirlos (reglas del bucket).
async function firmar(rutas: string[]) {
  const enlaces = new Map<string, string>();
  if (!MODO_EJEMPLO && rutas.length) {
    const { data } = await (await clienteServidor()).storage.from('facturas').createSignedUrls(rutas, 3600);
    for (const e of data ?? []) if (e.path && e.signedUrl) enlaces.set(e.path, e.signedUrl);
  }
  return enlaces;
}

// Un proveedor: cifras de las facturas cobradas, total por mes, tabla y (si los trae) pagos y cobros rechazados.
async function Facturas({ prov }: { prov: Proveedor }) {
  const d = await pedir<Gastos>('tablero_gastos', { p_proveedor: prov.id });
  const facturas = estadosDePago(d, prov);
  const p = palabrasDe(prov);
  const moneda = facturas[0]?.moneda ?? 'USD';
  const hoy = hoyBogota();
  const hace12 = restarDias(hoy, 365);
  const cobradas = facturas.filter(suma);
  const ultimos12 = cobradas.filter((f) => f.fecha > hace12);
  const cobrado12 = ultimos12.length ? ultimos12.reduce((s, f) => s + Number(f.monto ?? 0), 0) : null;
  const [ultima, penultima] = cobradas;
  const porMes = meses12(hoy);
  for (const f of cobradas) {
    const m = porMes.get(f.fecha.slice(0, 7));
    if (m) { m.total += Number(f.monto ?? 0); m.cobros += 1; }
  }
  const enlaces = await firmar(facturas.flatMap((f) => [f.archivo, f.archivo_csv ?? '']).filter(Boolean));
  // Lo que no está en pesos se muestra también en pesos, aproximado con la TRM del día de cada factura.
  const filas: Fila[] = facturas.map((f) => ({ f, prov }));
  const enPesos = moneda !== 'COP' ? await aPesos(filas) : null;
  const pesos12 = enPesos && filas.filter((x) => suma(x.f) && x.f.fecha > hace12).reduce((s, x) => s + Number(x.cop ?? 0), 0);

  const cifras: Cifra[] = [
    { etiqueta: (p.ultimo ?? `Último ${p.cobro}`) + (ultima?.periodo ? ` (${nombrePeriodo(ultima.periodo)})` : ''), valor: ultima?.monto ?? null,
      anterior: penultima?.monto ?? null, formato: (v) => dinero(v, moneda), principal: true, menorEsMejor: true,
      nota: ultima ? fechaLarga(ultima.fecha) : `Sin ${p.cobros} todavía` },
    { etiqueta: 'Total en 12 meses', valor: cobrado12, formato: (v) => dinero(v, moneda), nota: pesos12 ? `≈ ${dinero(pesos12, 'COP')}` : undefined },
    { etiqueta: 'Promedio por mes (12 meses)', valor: cobrado12 == null ? null : cobrado12 / 12, formato: (v) => dinero(v, moneda),
      nota: pesos12 ? `≈ ${dinero(pesos12 / 12, 'COP')}` : undefined },
    { etiqueta: `${mayuscula(p.cobros)} en 12 meses`, valor: ultimos12.length, nota: `${cobradas.length} desde el inicio` },
  ];

  return (
    <>
      {prov.pagos && <AlertaRechazos k={d.kpis} prov={prov} />}
      <Cifras items={cifras} />
      {prov.fuente && <Aviso>{prov.fuente}</Aviso>}
      <Rejilla>
        <PorMes porMes={porMes} moneda={moneda} />
        <Tarjeta titulo={p.tabla ?? mayuscula(p.cobros)} nota={`${facturas.length} ${facturas.length === 1 ? p.cobro : p.cobros}`} col={8}>
          <TablaFacturas filas={filas} enlaces={enlaces} numero={p.numero} vacio={`Aún no hay ${p.cobros}.`} />
        </Tarjeta>
        {prov.pagos && <Movimientos movimientos={d.movimientos} />}
      </Rejilla>
    </>
  );
}

// convertido: en la moneda del Total; cop: en pesos (aproximado con la TRM del día), para lo que no está en pesos.
interface Fila { f: FacturaProveedor; prov: Proveedor; convertido?: number | null; cop?: number | null }

// Llena el valor en pesos de cada fila y dice si hay algo que no esté en pesos.
async function aPesos(filas: Fila[]) {
  if (!filas.some((x) => x.f.moneda !== 'COP')) return false;
  const fechas = filas.map((x) => x.f.fecha).sort();
  const convertir = await convertidor('COP', filas.map((x) => x.f), fechas[0], fechas[fechas.length - 1]);
  for (const x of filas) x.cop = convertir(x.f);
  return true;
}

// Todos los proveedores de la página: cifras, total por mes y por proveedor en una sola moneda, y las facturas de 12 meses.
async function Total({ paginaId, proveedores, moneda }: { paginaId: string; proveedores: Proveedor[]; moneda: 'USD' | 'COP' }) {
  const activos = proveedores.filter((p) => !p.proximo);
  const datos = await Promise.all(activos.map((p) => pedir<Gastos>('tablero_gastos', { p_proveedor: p.id })));
  const hoy = hoyBogota();
  const hace12 = restarDias(hoy, 365);
  const hace24 = restarDias(hoy, 730);
  const filas: Fila[] = activos.flatMap((prov, i) => estadosDePago(datos[i], prov).filter((f) => f.fecha > hace24).map((f) => ({ f, prov })));
  const convertir = await convertidor(moneda, filas.map((x) => x.f), hace24, hoy);
  for (const x of filas) x.convertido = convertir(x.f);
  filas.sort((a, b) => b.f.fecha.localeCompare(a.f.fecha));

  const suman = filas.filter((x) => suma(x.f) && x.convertido != null);
  const sumar = (xs: Fila[]) => xs.reduce((s, x) => s + Number(x.convertido), 0);
  const de12 = suman.filter((x) => x.f.fecha > hace12);
  const total12 = sumar(de12);
  const anteriores = suman.filter((x) => x.f.fecha <= hace12);
  const esteMes = hoy.slice(0, 7);
  const [anio, mes] = hoy.split('-').map(Number);
  const mesPasado = new Date(Date.UTC(anio, mes - 2, 1)).toISOString().slice(0, 7);
  const porMes = meses12(hoy);
  for (const x of suman) {
    const m = porMes.get(x.f.fecha.slice(0, 7));
    if (m) { m.total += Number(x.convertido); m.cobros += 1; }
  }
  const porProveedor = activos.map((prov) => {
    const xs = de12.filter((x) => x.prov.id === prov.id);
    return { prov, total: sumar(xs), cobros: xs.length, ultima: filas.find((x) => x.prov.id === prov.id)?.f.fecha };
  }).sort((a, b) => b.total - a.total);
  const mayor = Math.max(1, ...porProveedor.map((x) => x.total));
  const sinTasa = filas.filter((x) => x.convertido == null && x.f.fecha > hace12);
  const lista = filas.filter((x) => x.f.fecha > hace12);
  const enlaces = await firmar(lista.flatMap((x) => [x.f.archivo, x.f.archivo_csv ?? '']).filter(Boolean));
  const monedas = [...new Set(filas.map((x) => x.f.moneda))];
  // En pesos: el mismo total si la página suma en pesos; si suma en dólares, aproximado con la TRM de cada factura.
  if (moneda === 'COP') for (const x of filas) x.cop = x.convertido; else await aPesos(filas);
  const pesos12 = moneda === 'COP' ? null : de12.reduce((s, x) => s + Number(x.cop ?? 0), 0);

  const cifras: Cifra[] = [
    { etiqueta: 'Total en 12 meses', valor: total12, anterior: anteriores.length ? sumar(anteriores) : null, formato: (v) => dinero(v, moneda),
      principal: true, menorEsMejor: true, nota: `${activos.length} proveedores, en ${NOMBRE_MONEDA[moneda]}${pesos12 ? ` · ≈ ${dinero(pesos12, 'COP')}` : ''}` },
    { etiqueta: 'Promedio por mes (12 meses)', valor: total12 / 12, formato: (v) => dinero(v, moneda),
      nota: pesos12 ? `≈ ${dinero(pesos12 / 12, 'COP')}` : undefined },
    { etiqueta: 'Este mes', valor: sumar(suman.filter((x) => x.f.fecha.startsWith(esteMes))), formato: (v) => dinero(v, moneda),
      nota: `${mayuscula(mesLargo(mesPasado + '-01'))}: ${dinero(sumar(suman.filter((x) => x.f.fecha.startsWith(mesPasado))), moneda)}` },
    { etiqueta: 'Facturas y cobros en 12 meses', valor: de12.length },
  ];

  return (
    <>
      <Cifras items={cifras} />
      <Aviso>
        Suma de las pestañas de esta página, por la fecha de cada factura o cobro. Las que el proveedor no cobró no suman.
        {monedas.some((m) => m !== moneda) && ` Todo se pasa a ${NOMBRE_MONEDA[moneda]} con la TRM del día de cada cobro${monedas.includes('EUR') ? ' (los euros, con la tasa del Banco Central Europeo de ese día)' : ''}.`}
        {moneda !== 'COP' && ' El valor en pesos es aproximado, con la TRM del día de cada factura.'}
        {sinTasa.length > 0 && ` ${sinTasa.length} ${sinTasa.length === 1 ? 'cobro no tiene' : 'cobros no tienen'} tasa de cambio y no ${sinTasa.length === 1 ? 'suma' : 'suman'}.`}
      </Aviso>
      <Rejilla>
        <PorMes porMes={porMes} moneda={moneda} />
        <Tarjeta titulo="Por proveedor" nota="Últimos 12 meses" col={8}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={th}>Proveedor</th><th className={th}><span className="sr-only">Participación</span></th>
                  <th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Facturas</th><th className={th}>Última</th>
                </tr>
              </thead>
              <tbody>
                {porProveedor.map(({ prov, total, cobros, ultima }) => (
                  <tr key={prov.id} className="border-b border-reja last:border-0">
                    <td className={`${td} whitespace-nowrap`}><Link href={`/${paginaId}?prov=${prov.id}`}>{prov.titulo}</Link></td>
                    <td className={`${td} w-full min-w-[80px]`}>
                      <span className="block h-2 rounded-full bg-lima" style={{ width: `${(total / mayor) * 100}%` }} aria-hidden />
                    </td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{total ? dinero(total, moneda) : '—'}</td>
                    <td className={`${td} whitespace-nowrap text-right text-suave tabular-nums`}>{cobros || ''}</td>
                    <td className={`${td} whitespace-nowrap text-suave`}>{ultima ? fechaLarga(ultima) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Facturas y cobros" nota={`Últimos 12 meses · ${lista.length}`}>
          <TablaFacturas filas={lista} enlaces={enlaces} numero="Número" conProveedor vacio="Aún no hay facturas ni cobros." />
        </Tarjeta>
      </Rejilla>
    </>
  );
}

// Pasa cada factura a la moneda del total: dólares ↔ pesos con la TRM del día (trm_diaria, la última conocida a esa fecha);
// euros a dólares con la tasa del Banco Central Europeo (Frankfurter). Sin tasa, la factura queda sin convertir (null).
async function convertidor(destino: string, facturas: FacturaProveedor[], desde: string, hasta: string) {
  const monedas = new Set(facturas.map((f) => f.moneda));
  if ([...monedas].every((m) => m === destino)) return (f: FacturaProveedor) => (f.monto == null ? null : Number(f.monto));
  const ultimaHasta = (serie: [string, number][], fecha: string) => {
    let v: number | null = null;
    for (const [d, x] of serie) { if (d > fecha) break; v = x; }
    return v;
  };
  let trm: [string, number][] = [];
  let eur: [string, number][] = [];
  if (MODO_EJEMPLO) { trm = [[desde, 4000]]; eur = [[desde, 1.1]]; } else {
    // La TRM va desde 2021 (un valor por día): se lee de a 1.000 filas, el máximo que entrega Supabase por consulta.
    const supabase = await clienteServidor();
    for (let i = 0; ; i += 1000) {
      const { data } = await supabase.from('trm_diaria').select('fecha, valor').gte('fecha', restarDias(desde, 10)).lte('fecha', hasta)
        .order('fecha').range(i, i + 999);
      trm.push(...(data ?? []).map((r: { fecha: string; valor: number }) => [r.fecha, Number(r.valor)] as [string, number]));
      if (!data || data.length < 1000) break;
    }
    if (monedas.has('EUR')) {
      try {
        const r = await fetch(`https://api.frankfurter.app/${restarDias(desde, 10)}..${hasta}?from=EUR&to=USD`, { next: { revalidate: 86400 } });
        const j = (await r.json()) as { rates?: Record<string, { USD: number }> };
        eur = Object.entries(j.rates ?? {}).map(([d, x]) => [d, x.USD] as [string, number]).sort((a, b) => a[0].localeCompare(b[0]));
      } catch { eur = []; }
    }
  }
  return (f: FacturaProveedor) => {
    if (f.monto == null) return null;
    const monto = Number(f.monto);
    if (f.moneda === destino) return monto;
    const t = ultimaHasta(trm, f.fecha);
    const e = f.moneda === 'EUR' ? ultimaHasta(eur, f.fecha) : null;
    const usd = f.moneda === 'USD' ? monto : f.moneda === 'COP' ? (t ? monto / t : null) : e ? monto * e : null;
    if (usd == null) return null;
    return destino === 'USD' ? usd : t ? usd * t : null;
  };
}

function PorMes({ porMes, moneda }: { porMes: Map<string, { total: number; cobros: number }>; moneda: string }) {
  const mayor = Math.max(1, ...[...porMes.values()].map((m) => m.total));
  return (
    <Tarjeta titulo="Total por mes" nota="Últimos 12 meses" col={4}>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {[...porMes.entries()].map(([mes, m]) => (
            <tr key={mes} className="border-b border-reja last:border-0">
              <td className={`${td} whitespace-nowrap`}>{mayuscula(nombrePeriodo(mes))}</td>
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
  );
}

// La misma tabla en todas las pestañas. En el Total lleva además el proveedor. Si hay montos en dólares o euros, al lado va
// el valor en pesos, aproximado con la TRM del día de cada factura.
function TablaFacturas({ filas, enlaces, numero, vacio, conProveedor }: {
  filas: Fila[]; enlaces: Map<string, string>; numero: string; vacio: string; conProveedor?: boolean;
}) {
  const conPeriodo = filas.some((x) => x.f.periodo);
  const conPesos = filas.some((x) => x.f.moneda !== 'COP');
  const columnas = 6 + (conProveedor ? 1 : 0) + (conPeriodo ? 1 : 0) + (conPesos ? 1 : 0);
  return (
    <div className="-mx-1 max-h-[560px] overflow-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-superficie">
          <tr>
            <th className={th}>Fecha</th>{conProveedor && <th className={th}>Proveedor</th>}{conPeriodo && <th className={th}>Consumo de</th>}
            <th className={th}>Cuenta</th><th className={th}>{numero}</th><th className={`${th} text-right`}>Total</th>
            {conPesos && <th className={`${th} text-right`} title="Con la TRM del día de cada factura">En pesos (aprox.)</th>}
            <th className={th}>Estado</th><th className={th}><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {filas.length ? filas.map(({ f, prov, cop }) => {
            const p = palabrasDe(prov);
            const url = enlaces.get(f.archivo);
            const urlCsv = f.archivo_csv ? enlaces.get(f.archivo_csv) : undefined;
            const recibo = !url && prov.recibo ? prov.recibo(f) : '';
            const estado = ESTADOS[f.estado];
            const nombre = `${prov.titulo} ${f.periodo || f.numero || f.fecha}`;
            return (
              <tr key={`${prov.id}:${f.id}`} className="border-b border-reja last:border-0">
                <td className={`${td} whitespace-nowrap`}>{fechaLarga(f.fecha)}</td>
                {conProveedor && <td className={`${td} whitespace-nowrap`}>{prov.titulo}</td>}
                {conPeriodo && <td className={`${td} whitespace-nowrap`}>{f.periodo ? nombrePeriodo(f.periodo) : ''}</td>}
                <td className={td}>{f.cuenta}</td>
                <td className={`${td} tabular-nums text-suave`}>{f.numero || '—'}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {estado?.noSuma ? <s className="text-tenue">{dinero(f.monto, f.moneda)}</s> : dinero(f.monto, f.moneda)}
                </td>
                {conPesos && (
                  <td className={`${td} whitespace-nowrap text-right tabular-nums text-suave`}>
                    {cop == null ? '—' : estado?.noSuma ? <s className="text-tenue">{dinero(cop, 'COP')}</s> : dinero(cop, 'COP')}
                  </td>
                )}
                <td className={td}>{f.estado ? (
                  <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] ${(estado ?? ESTADOS.PENDING).clase}`}>{estado?.texto ?? f.estado}</span>
                ) : <span className="text-tenue">—</span>}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <span className="inline-flex gap-1.5">
                    {url ? (
                      <>
                        <a className={boton} href={url} target="_blank" rel="noopener noreferrer">Ver</a>
                        <a className={boton} href={`${url}&download=${encodeURIComponent(nombre + '.pdf')}`}>Descargar</a>
                      </>
                    ) : recibo ? <a className={boton} href={recibo} target="_blank" rel="noopener noreferrer">{p.enlace ?? p.recibo}</a>
                      : <span className="text-tenue">PDF pendiente</span>}
                    {urlCsv && <a className={boton} href={`${urlCsv}&download=${encodeURIComponent(nombre + '.csv')}`}>Detalle CSV</a>}
                    {f.correo_url && f.correo_url !== recibo && (
                      <a className={boton} href={f.correo_url} target="_blank" rel="noopener noreferrer">{prov.enlaceTexto ?? 'Correo'}</a>
                    )}
                  </span>
                </td>
              </tr>
            );
          }) : (
            <tr><td colSpan={columnas} className="px-2 py-5 text-center text-tenue">{vacio}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Cobros rechazados después del último pago (Google Workspace): aviso arriba de la pestaña con el botón de pago.
function AlertaRechazos({ k, prov }: { k: GastosKpis; prov: Proveedor }) {
  if (!(Number(k.rechazos_sin_pago) > 0)) return null;
  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-l-4 border-linea border-l-malo bg-superficie px-3.5 py-3 text-[13px] md:flex-row md:items-center md:justify-between">
      <span>
        <strong className="font-semibold">Hay {k.rechazos_sin_pago} {Number(k.rechazos_sin_pago) === 1 ? 'cobro rechazado' : 'cobros rechazados'} después del último pago</strong>
        {k.ultimo_pago ? <> ({fechaLarga(k.ultimo_pago)})</> : null}. El último rechazo fue el {k.ultimo_rechazo ? fechaLarga(k.ultimo_rechazo) : '—'}.
        Revisa la tarjeta y paga el saldo para que no se suspenda el servicio.
      </span>
      {prov.pagar && <a href={prov.pagar} target="_blank" rel="noopener noreferrer" className={principal}>{prov.pagarTexto}</a>}
    </div>
  );
}

function Movimientos({ movimientos }: { movimientos: MovimientoProveedor[] }) {
  return (
    <Tarjeta titulo="Pagos y cobros rechazados">
      <div className="-mx-1 max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-superficie">
            <tr>
              <th className={th}>Fecha</th><th className={th}>Cuenta</th><th className={th}>Movimiento</th>
              <th className={`${th} text-right`}>Monto</th><th className={th}>Detalle</th><th className={th}><span className="sr-only">Correo</span></th>
            </tr>
          </thead>
          <tbody>
            {movimientos.length ? movimientos.map((m, i) => (
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
  );
}
