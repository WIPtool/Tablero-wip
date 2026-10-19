import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Cifras, Tarjeta, Rejilla, Aviso } from '@/componentes/Bloques';
import { FormularioCosto, FormularioGasto, FormularioPago } from '@/componentes/FormularioCosto';
import { terminarCosto, eliminarCosto, eliminarGasto, eliminarPago, marcarPagado } from './acciones';
import { BotonEliminar } from '@/componentes/BotonEliminar';
import { pedir, type Costos, type Suscripcion, type Pago } from '@/lib/datos';
import { buscarPagina } from '@/lib/paginas';
import { fechaLarga, mesLargo, pesos } from '@/lib/formato';
import { hoyBogota } from '@/lib/rango';

export const metadata: Metadata = { title: 'Costos de marketing' };

const dos = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const valor = (monto: number | null, moneda: string) => (monto == null ? '—' : moneda === 'USD' ? `US$ ${dos.format(monto)}` : pesos(monto));
const COBRO: Record<string, string> = { mensual: 'Mensual', anual: 'Anual', prepago: 'Prepago', consumo: 'Por consumo', gratis: 'Gratis' };
const ESTADO: Record<string, { texto: string; clase: string }> = {
  activo: { texto: 'Activo', clase: 'border-bueno/40 text-bueno' },
  prueba: { texto: 'En prueba', clase: 'border-aviso text-aviso' },
  suspendido: { texto: 'Suspendido', clase: 'border-malo/50 text-malo' },
  por_confirmar: { texto: 'Por confirmar', clase: 'border-linea text-suave' },
};
const PAGO: Record<string, { texto: string; clase: string }> = {
  pagado: { texto: 'Pagado', clase: 'text-bueno' },
  pendiente: { texto: 'Pendiente', clase: 'text-aviso' },
  fallido: { texto: 'Falló', clase: 'text-malo' },
};
// Orden de las categorías en la tabla de licencias.
const CATEGORIAS = ['CRM y WhatsApp', 'Automatización e IA', 'Herramientas de marketing', 'Prospección', 'Operación de la plataforma'];
const boton = 'rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-tenue hover:text-tinta';
const th = 'border-b border-linea px-2 py-1.5 font-medium';
const td = 'px-2 py-2 align-top';

const mesDe = (v?: string) => (v && /^\d{4}-\d{2}$/.test(v) ? `${v}-01` : hoyBogota().slice(0, 8) + '01');
const otroMes = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};

function Etiqueta({ estado }: { estado: string }) {
  const e = ESTADO[estado] ?? ESTADO.activo;
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${e.clase}`}>{e.texto}</span>;
}

function TablaLicencias({ lista, hoy }: { lista: Suscripcion[]; hoy: string }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-xs text-suave">
            <th className={th}>Plataforma</th>
            <th className={`${th} text-right`}>Licencia mensual</th>
            <th className={th}>Cobro</th>
            <th className={th}>Activo desde</th>
            <th className={`${th} text-right`}>Este mes</th>
            <th className={th}>Próximo pago</th>
            <th className={th}>Último pago</th>
            <th className={th}>Estado</th>
            <th className={th}></th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => {
            const esConsumo = c.cobro === 'prepago' || c.cobro === 'consumo';
            const esteMes = esConsumo ? c.gasto_mes : c.cop_mes;
            return (
              <tr key={c.id} className="border-b border-reja last:border-0">
                <td className={`${td} min-w-[260px]`}>
                  <span className="font-medium">{c.plataforma}</span>
                  {c.para_que && <span className="block text-[12px] text-suave">{c.para_que}</span>}
                  {c.nota && <span className="mt-0.5 block text-[12px] text-tenue">{c.nota}</span>}
                </td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {c.cobro === 'gratis' ? 'Gratis' : esConsumo ? <span className="text-suave">Según uso</span> : valor(c.monto, c.moneda)}
                </td>
                <td className={`${td} whitespace-nowrap`}>{COBRO[c.cobro] ?? c.cobro}{c.metodo_pago && <span className="block text-[12px] text-suave">{c.metodo_pago}</span>}</td>
                <td className={`${td} whitespace-nowrap`}>{fechaLarga(c.desde)}{c.hasta && <span className="block text-[12px] text-suave">hasta {fechaLarga(c.hasta)}</span>}</td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                  {esteMes ? pesos(esteMes) : <span className="text-tenue">$ 0</span>}
                  {esteMes > 0 && c.cop_mes < esteMes && <span className="block text-[11.5px] text-suave">no suma a marketing</span>}
                </td>
                <td className={`${td} whitespace-nowrap`}>{c.proximo_pago ? fechaLarga(c.proximo_pago) : <span className="text-tenue">—</span>}</td>
                <td className={`${td} whitespace-nowrap`}>
                  {c.ultimo_pago ? (
                    <>
                      {fechaLarga(c.ultimo_pago)}
                      <span className="block text-[12px]">
                        {c.ultimo_pago_monto != null && <span className="tabular-nums">{valor(c.ultimo_pago_monto, c.moneda)} · </span>}
                        <span className={PAGO[c.ultimo_pago_estado]?.clase ?? 'text-suave'}>{PAGO[c.ultimo_pago_estado]?.texto ?? c.ultimo_pago_estado}</span>
                      </span>
                    </>
                  ) : <span className="text-tenue">—</span>}
                </td>
                <td className={td}><Etiqueta estado={c.estado} /></td>
                <td className={td}>
                  <div className="flex flex-wrap justify-end gap-2">
                    {!c.hasta && (
                      <form action={terminarCosto}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="hasta" value={hoy} />
                        <button type="submit" className={boton} title="Deja de sumar a la inversión a partir de mañana">Terminar hoy</button>
                      </form>
                    )}
                    <BotonEliminar accion={eliminarCosto} id={c.id} titulo="Lo borra también de los meses anteriores"
                      pregunta={`¿Eliminar ${c.plataforma}? Se quita de la inversión de todos los meses. Si solo dejaron de pagarlo, usa "Terminar hoy".`} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TablaPagos({ lista, vacio }: { lista: Pago[]; vacio: string }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-xs text-suave">
            {['Fecha', 'Plataforma', 'Valor', 'Estado', 'Referencia', ''].map((t, i) => (
              <th key={i} className={`${th} ${i === 2 ? 'text-right' : ''}`}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.length ? lista.map((p) => (
            <tr key={p.id} className="border-b border-reja last:border-0">
              <td className={`${td} whitespace-nowrap`}>{fechaLarga(p.fecha)}</td>
              <td className={td}>{p.plataforma}{p.nota && <span className="block text-[12px] text-suave">{p.nota}</span>}</td>
              <td className={`${td} whitespace-nowrap text-right tabular-nums`}>
                {valor(p.monto, p.moneda)}{p.moneda === 'USD' && <span className="block text-[12px] text-suave">{pesos(p.cop)}</span>}
              </td>
              <td className={`${td} whitespace-nowrap font-semibold ${PAGO[p.estado]?.clase ?? ''}`}>{PAGO[p.estado]?.texto ?? p.estado}</td>
              <td className={`${td} text-[12px] text-suave`}>{p.referencia}</td>
              <td className={td}>
                <div className="flex flex-wrap justify-end gap-2">
                  {p.estado === 'pendiente' && (
                    <form action={marcarPagado}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className={boton}>Marcar pagado</button>
                    </form>
                  )}
                  <BotonEliminar accion={eliminarPago} id={p.id} titulo="Borra el registro del pago" pregunta={`¿Eliminar el pago de ${p.plataforma} del ${fechaLarga(p.fecha)}?`} />
                </div>
              </td>
            </tr>
          )) : <tr><td colSpan={6} className="px-2 py-5 text-center text-tenue">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaCostos({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const mes = mesDe((await searchParams).mes);
  const d = await pedir<Costos>('tablero_costos', { p_mes: mes });
  const hoy = hoyBogota();
  const esMesActual = d.mes.slice(0, 7) === hoy.slice(0, 7);

  const vigentes = d.suscripciones.filter((c) => !c.hasta || c.hasta >= d.mes);
  const terminadas = d.suscripciones.filter((c) => c.hasta && c.hasta < d.mes);
  const orden = (c: Suscripcion) => { const i = CATEGORIAS.indexOf(c.categoria); return i < 0 ? 99 : i; };
  const categorias = [...new Set(vigentes.sort((a, b) => orden(a) - orden(b) || a.plataforma.localeCompare(b.plataforma, 'es')).map((c) => c.categoria))];

  const pauta = d.pauta.meta + d.pauta.gads;
  const licencias = d.suscripciones.filter((c) => c.cobro === 'mensual' || c.cobro === 'anual').reduce((s, c) => s + c.cop_mes, 0);
  const consumo = Math.max(0, d.total - pauta - licencias);
  const pagosMeta = d.pagos.filter((p) => p.plataforma === 'Meta Ads');
  const otrosPagos = d.pagos.filter((p) => p.plataforma !== 'Meta Ads');
  const pendientes = d.pagos.filter((p) => p.estado === 'pendiente');
  const porPagar = pendientes.reduce((s, p) => s + p.cop, 0);
  const pagadoMeta = pagosMeta.filter((p) => p.estado === 'pagado').reduce((s, p) => s + p.cop, 0);
  const alertas = [
    ...d.suscripciones.filter((c) => (c.estado !== 'activo' || c.cobro === 'prepago') && (!c.hasta || c.hasta >= d.mes || c.estado === 'suspendido')),
  ];
  const fallidos = d.pagos.filter((p) => p.estado === 'fallido');
  const plataformas = [...new Set([...d.suscripciones.map((c) => c.plataforma), 'Meta Ads'])].sort((a, b) => a.localeCompare(b, 'es'));

  // Gasto total del mes por bloque.
  const filasTotal = [
    { etiqueta: 'Pauta (Meta y Google Ads)', valor: pauta, nota: 'Inversión de los anuncios según cada plataforma' },
    { etiqueta: 'Licencias y suscripciones', valor: licencias, nota: 'Valor mensual repartido por día hasta hoy' },
    { etiqueta: 'Consumo (Explee, Claude API, WhatsApp comercial)', valor: consumo, nota: 'Lo registrado en el mes' },
  ];

  return (
    <>
      <Encabezado pagina={buscarPagina('costos')!} />
      <nav className="flex flex-wrap items-center gap-3 text-[13px]" aria-label="Mes">
        <Link href={`/costos?mes=${otroMes(d.mes, -1)}`} className={boton}>‹ {mesLargo(otroMes(d.mes, -1))}</Link>
        <span className="font-semibold">{mesLargo(d.mes).replace(/^./, (l) => l.toUpperCase())}{esMesActual && <span className="font-normal text-suave"> · hasta el {fechaLarga(d.corte)}</span>}</span>
        {!esMesActual && <Link href={`/costos?mes=${otroMes(d.mes, 1)}`} className={boton}>{mesLargo(otroMes(d.mes, 1))} ›</Link>}
        {d.trm && <span className="text-suave">TRM {pesos(d.trm)}</span>}
      </nav>

      <Cifras items={[
        { etiqueta: 'Gasto de marketing del mes', valor: d.total, formato: pesos, principal: true, nota: 'Pauta, licencias y consumo, en pesos' },
        { etiqueta: 'Pauta', valor: pauta, formato: pesos, nota: `Pagado a Meta: ${pesos(pagadoMeta)}` },
        { etiqueta: 'Licencias y suscripciones', valor: licencias, formato: pesos },
        { etiqueta: 'Consumo', valor: consumo, formato: pesos, nota: 'Explee, Claude API y WhatsApp' },
        { etiqueta: 'Por pagar', valor: porPagar, formato: pesos, nota: pendientes.length ? pendientes.map((p) => p.plataforma).join(', ') : 'Nada pendiente' },
      ]} />

      {(alertas.length > 0 || fallidos.length > 0) && (
        <Aviso>
          <strong className="font-semibold">Para revisar</strong>
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
            {alertas.map((c) => (
              <li key={c.id}><strong className="font-semibold">{c.plataforma}</strong> ({ESTADO[c.estado]?.texto.toLowerCase()}{c.cobro === 'prepago' ? ', prepago' : ''}): {c.nota}</li>
            ))}
            {fallidos.map((p) => (
              <li key={`p${p.id}`}><strong className="font-semibold">{p.plataforma}</strong>: el cobro del {fechaLarga(p.fecha)} por {valor(p.monto, p.moneda)} falló{p.nota ? ` (${p.nota})` : ''}.</li>
            ))}
          </ul>
        </Aviso>
      )}

      <Rejilla>
        <Tarjeta titulo="Licencias y herramientas" nota="Este mes: lo que lleva sumado en el mes (las de consumo, lo que han gastado). Lo que está en dólares se pasa a pesos con la TRM del día.">
          <div className="flex flex-col gap-5">
            {categorias.map((cat) => (
              <div key={cat} className="flex flex-col gap-1.5">
                <h3 className="text-[13px] font-semibold text-suave">{cat}</h3>
                <TablaLicencias lista={vigentes.filter((c) => c.categoria === cat)} hoy={hoy} />
              </div>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Consumo del mes" col={6} nota="Cargos por uso y recargas registradas. Explee llega solo desde su API.">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-xs text-suave">
                  {['Fecha', 'Plataforma', 'Valor', 'En pesos', ''].map((t, i) => <th key={i} className={`${th} ${i === 2 || i === 3 ? 'text-right' : ''}`}>{t}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-reja">
                  <td className={`${td} whitespace-nowrap text-suave`}>Todo el mes</td>
                  <td className={td}>Explee<span className="block text-[12px] text-suave">{d.explee.enviados.toLocaleString('es-CO')} correos enviados (dato diario de Explee)</span></td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{valor(d.explee.usd, 'USD')}</td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{pesos(d.explee.cop)}</td>
                  <td className={td}></td>
                </tr>
                {d.gastos.map((g) => (
                  <tr key={g.id} className="border-b border-reja last:border-0">
                    <td className={`${td} whitespace-nowrap`}>{fechaLarga(g.fecha)}</td>
                    <td className={td}>{g.plataforma}{g.concepto && <span className="block text-[12px] text-suave">{g.concepto}</span>}
                      {!g.suma_inversion && <span className="block text-[11.5px] text-suave">No suma a marketing</span>}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{valor(g.monto, g.moneda)}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{pesos(g.cop)}</td>
                    <td className={td}><BotonEliminar accion={eliminarGasto} id={g.id} titulo="Borra el gasto" pregunta={`¿Eliminar el gasto de ${g.plataforma} del ${fechaLarga(g.fecha)}?`} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Pauta" col={6} nota="Meta cobra a la tarjeta cada vez que el gasto llega a su umbral, por eso hay varios pagos al mes.">
          <dl className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-lg border border-linea px-3 py-2"><dt className="text-suave">Inversión en Meta Ads</dt><dd className="text-lg font-bold tabular-nums">{pesos(d.pauta.meta)}</dd></div>
            <div className="rounded-lg border border-linea px-3 py-2"><dt className="text-suave">Inversión en Google Ads</dt><dd className="text-lg font-bold tabular-nums">{pesos(d.pauta.gads)}</dd></div>
            <div className="rounded-lg border border-linea px-3 py-2"><dt className="text-suave">Pagado a Meta en el mes</dt><dd className="text-lg font-bold tabular-nums">{pesos(pagadoMeta)}</dd></div>
            <div className="rounded-lg border border-linea px-3 py-2"><dt className="text-suave">Saldo pendiente con Meta</dt><dd className="text-lg font-bold tabular-nums text-aviso">{pesos(pagosMeta.filter((p) => p.estado === 'pendiente').reduce((s, p) => s + p.cop, 0))}</dd></div>
          </dl>
          <h3 className="text-[13px] font-semibold text-suave">Pagos de Meta Ads</h3>
          <TablaPagos lista={pagosMeta} vacio="Sin pagos de Meta registrados este mes." />
        </Tarjeta>

        <Tarjeta titulo="Pagos de herramientas" col={6} nota="Cobros de las suscripciones y recargas del mes.">
          <TablaPagos lista={otrosPagos} vacio="Sin pagos registrados este mes." />
        </Tarjeta>

        <Tarjeta titulo="Gasto total del mes" col={6} nota={esMesActual ? `Hasta el ${fechaLarga(d.corte)}` : undefined}>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {filasTotal.map((f) => (
                <tr key={f.etiqueta} className="border-b border-reja">
                  <td className={td}>{f.etiqueta}<span className="block text-[12px] text-suave">{f.nota}</span></td>
                  <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{pesos(f.valor)}</td>
                </tr>
              ))}
              <tr className="border-b border-linea">
                <td className={`${td} font-bold`}>Total marketing</td>
                <td className={`${td} whitespace-nowrap text-right text-base font-bold tabular-nums`}>{pesos(d.total)}</td>
              </tr>
              <tr className="border-b border-reja">
                <td className={td}>Operación de la plataforma<span className="block text-[12px] text-suave">WhatsApp de las notificaciones a clientes finales; no es marketing</span></td>
                <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{pesos(d.fuera_marketing)}</td>
              </tr>
              <tr>
                <td className={`${td} font-bold`}>Total general</td>
                <td className={`${td} whitespace-nowrap text-right text-base font-bold tabular-nums`}>{pesos(d.total + d.fuera_marketing)}</td>
              </tr>
            </tbody>
          </table>
          <details className="text-[13px]">
            <summary className="cursor-pointer text-suave">Por plataforma</summary>
            <table className="mt-2 w-full border-collapse">
              <tbody>
                {d.por_plataforma.map((p) => (
                  <tr key={p.plataforma} className="border-b border-reja last:border-0">
                    <td className="px-2 py-1.5">{p.plataforma}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{pesos(p.cop)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Tarjeta>

        {terminadas.length > 0 && (
          <Tarjeta titulo="Terminadas" nota="Siguen sumando en los meses en que estuvieron activas.">
            <TablaLicencias lista={terminadas} hoy={hoy} />
          </Tarjeta>
        )}

        <Tarjeta titulo="Agregar una licencia o herramienta">
          <FormularioCosto hoy={hoy} categorias={CATEGORIAS} />
        </Tarjeta>
        <Tarjeta titulo="Registrar un gasto de consumo" col={6}>
          <FormularioGasto hoy={hoy} plataformas={plataformas} />
        </Tarjeta>
        <Tarjeta titulo="Registrar un pago" col={6}>
          <FormularioPago hoy={hoy} plataformas={plataformas} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
