import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { BotonEliminar } from '@/componentes/BotonEliminar';
import { FormularioFactura } from '@/componentes/FormularioFactura';
import { eliminarFactura } from './acciones';
import { pedir, type General } from '@/lib/datos';
import { fechaLarga, mesLargo, num, pct, pesos } from '@/lib/formato';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'WIP General' };

const MESES_GRAFICA = 24;
const signo = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '+' : ''}${pct(v)}`);
const veces = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} x`);
const meses = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${v.toLocaleString('es-CO', { maximumFractionDigits: 1 })} meses`);
const nombreMes = (iso: string) => mesLargo(iso);
const trimestre = (iso: string) => `T${Math.floor(Number(iso.slice(5, 7)) / 3) + 1} ${iso.slice(0, 4)}`;
const tono = (v: number | null | undefined, bueno: number, malo: number, mayorEsMejor = true) => {
  if (v == null || !Number.isFinite(v)) return 'text-tenue';
  const ok = mayorEsMejor ? v >= bueno : v <= bueno;
  const mal = mayorEsMejor ? v < malo : v > malo;
  return ok ? 'text-bueno' : mal ? 'text-malo' : 'text-aviso';
};
const th = 'border-b border-linea px-2 py-1.5 text-left text-xs font-medium text-suave';
const td = 'border-b border-reja px-2 py-2 align-top';

// Fila "indicador · valor · qué significa" de las tablas de indicadores.
function Indicador({ nombre, valor, clase = '', nota }: { nombre: string; valor: string; clase?: string; nota: string }) {
  return (
    <tr>
      <td className={`${td} font-medium`}>{nombre}</td>
      <td className={`${td} whitespace-nowrap text-right text-[15px] font-bold tabular-nums ${clase}`}>{valor}</td>
      <td className={`${td} text-[12.5px] text-suave`}>{nota}</td>
    </tr>
  );
}
function Indicadores({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead><tr><th className={th}>Indicador</th><th className={`${th} text-right`}>Valor</th><th className={th}>Qué nos dice</th></tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default async function PaginaGeneral() {
  const d = await pedir<General>('tablero_general');
  const h = d.hero, c = d.crecimiento, cl = d.clientes, r = d.retencion, q = d.quick_ratio, k = d.cac, ing = d.ingresos;
  const ult = nombreMes(d.ultimo_mes);
  const serie = d.serie.slice(-MESES_GRAFICA).map((x) => ({ fecha: x.mes, servicios: x.servicios, activos: x.activos }));
  const hayIngresos = ing.meses_cargados > 0 && (ing.mrr ?? 0) > 0;

  // Unidad económica (con facturación): ARPA mensual, LTV = ARPA × margen ÷ churn mensual, payback y LTV/CAC.
  const cac = k.clientes_90 > 0 ? k.inversion_90 / k.clientes_90 : null;
  const arpa = hayIngresos && ing.clientes_facturados ? (ing.mrr ?? 0) / ing.clientes_facturados : null;
  const churn = cl.churn_3m && cl.churn_3m > 0 ? cl.churn_3m : null;
  const ltv = arpa != null && churn ? (arpa * d.margen) / churn : null;
  const payback = arpa != null && cac != null ? cac / (arpa * d.margen) : null;

  const etapas = d.embudo.etapas ?? [];
  const leads = etapas[0]?.oportunidades ?? 0;

  return (
    <>
      <Encabezado pagina={buscarPagina('general')!} />
      <p className="-mt-2 text-[13px] text-suave">
        Meses cerrados hasta {ult}. Servicios cargados desde la plataforma hasta el {d.ultimo_dia ? fechaLarga(d.ultimo_dia) : '—'}.
        Cliente activo: al menos {d.minimo} servicios en el mes (las cuentas de prueba no cuentan).
      </p>

      <Cifras items={[
        { etiqueta: `Servicios registrados · ${ult}`, valor: h.ultimo, anterior: h.anterior, principal: true },
        { etiqueta: 'Mes en curso', valor: h.actual, nota: `Proyección al cierre: ${num(h.proyeccion)}` },
        { etiqueta: 'Últimos 12 meses', valor: c.ttm, anterior: c.ttm_anterior },
        { etiqueta: `Clientes activos · ${ult}`, valor: cl.activos, anterior: cl.activos_ant },
        { etiqueta: 'Retención neta de servicios (12 meses)', valor: r.nrr, formato: pct, nota: 'Por encima de 100 % crecemos con los mismos clientes' },
      ]} />

      {r.nrr != null && r.nrr < 0.9 && (
        <Aviso>
          <strong className="font-semibold">Alerta de retención.</strong> Los clientes que estaban activos hace un año hoy registran el{' '}
          {pct(r.nrr)} de los servicios que registraban entonces ({r.siguen} de {r.clientes} siguen activos). El crecimiento depende de
          clientes nuevos; vale la pena revisar quiénes bajaron en <Link href="/servicios" className="underline">Servicios</Link>.
        </Aviso>
      )}

      <Rejilla>
        <Tarjeta titulo="Hero metric: servicios registrados por mes" nota={`Récord: ${num(h.record)} en ${h.record_mes ? nombreMes(h.record_mes) : '—'} · el último mes va en curso`}>
          <Leyenda items={[{ etiqueta: 'Servicios registrados', color: 'var(--serie-1)' }, { etiqueta: 'Clientes activos', color: 'var(--serie-2)' }]} />
          <GraficaPaneles porMes serie={serie} alto={190} paneles={[
            { campo: 'servicios', etiqueta: 'Servicios registrados', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'activos', etiqueta: 'Clientes activos', forma: 'linea', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>

        <Tarjeta titulo="Crecimiento" col={6} nota="Sobre servicios registrados, con meses cerrados">
          <Indicadores>
            <Indicador nombre="Crecimiento MoM" valor={signo(c.mom)} clase={tono(c.mom, 0.03, 0)} nota={`${ult} contra el mes anterior. Un solo mes es ruidoso: mira también el CMGR.`} />
            <Indicador nombre="CMGR 3 meses" valor={signo(c.cmgr3)} clase={tono(c.cmgr3, 0.03, 0)} nota="Crecimiento mensual compuesto del último trimestre. Meta sana para una SaaS B2B en esta etapa: 3 % a 5 % mensual." />
            <Indicador nombre="CMGR 6 meses" valor={signo(c.cmgr6)} clase={tono(c.cmgr6, 0.03, 0)} nota="Tendencia del semestre." />
            <Indicador nombre="CMGR 12 meses" valor={signo(c.cmgr12)} clase={tono(c.cmgr12, 0.03, 0)} nota="Compara el último mes con el mismo mes del año pasado, llevado a ritmo mensual." />
            <Indicador nombre="Crecimiento anual (12 meses)" valor={signo(c.anual)} clase={tono(c.anual, 0.3, 0)} nota="Servicios de los últimos 12 meses contra los 12 anteriores. Es la cifra más estable." />
            <Indicador nombre="CAGR" valor={signo(c.cagr)} clase={tono(c.cagr, 0.3, 0)} nota={`Crecimiento anual compuesto desde los primeros 12 meses de la plataforma (hasta ${c.cagr_desde ? nombreMes(c.cagr_desde) : '—'}).`} />
          </Indicadores>
        </Tarjeta>

        <Tarjeta titulo="Clientes y churn" col={6} nota={`Cliente activo: ${d.minimo} servicios o más en el mes`}>
          <Indicadores>
            <Indicador nombre="Clientes activos" valor={num(cl.activos)} nota={`Hace un año: ${num(cl.activos_hace_un_ano)}.`} />
            <Indicador nombre="Nuevos (3 meses)" valor={num(cl.nuevos_3m)} nota="Clientes que tuvieron su primer mes activo en el último trimestre." />
            <Indicador nombre="Perdidos (3 meses)" valor={num(cl.perdidos_3m)} nota="Activos un mes que al siguiente bajaron del mínimo o dejaron de usar la plataforma." />
            <Indicador nombre="Churn de clientes (mensual, 3 meses)" valor={pct(cl.churn_3m)} clase={tono(cl.churn_3m, 0.02, 0.05, false)} nota="En B2B sano está por debajo de 2 % al mes. Arriba de 5 % se pierde más de la mitad de la base al año." />
            <Indicador nombre="Churn de clientes (mensual, 12 meses)" valor={pct(cl.churn_12m)} clase={tono(cl.churn_12m, 0.02, 0.05, false)} nota={`Último mes: ${pct(cl.churn_ultimo)}.`} />
            <Indicador nombre="Retención de clientes a 12 meses" valor={pct(r.logos)} clase={tono(r.logos, 0.85, 0.7)} nota={`${r.siguen} de los ${r.clientes} clientes activos hace un año siguen activos.`} />
          </Indicadores>
        </Tarjeta>

        <Tarjeta titulo="Retención y expansión (NRR / GRR)" col={6} nota="Cobramos por servicio: la retención de servicios es nuestro NRR">
          <Indicadores>
            <Indicador nombre="NRR de servicios" valor={pct(r.nrr)} clase={tono(r.nrr, 1, 0.9)} nota="Servicios de los últimos 3 meses de los clientes que estaban activos hace un año, contra lo que registraban entonces. Incluye expansión." />
            <Indicador nombre="GRR de servicios" valor={pct(r.grr)} clase={tono(r.grr, 0.9, 0.8)} nota="Igual al NRR pero sin contar crecimiento: solo lo que se perdió por bajas y contracción. Meta: 90 % o más." />
            <Indicador nombre="Quick ratio de servicios" valor={veces(q.ratio)} clase={tono(q.ratio, 4, 1)} nota={`(nuevos ${num(q.nuevos)} + expansión ${num(q.expansion)}) ÷ (contracción ${num(q.contraccion)} + pérdida ${num(q.perdida)}) mes a mes, último trimestre. Más de 4 es crecimiento eficiente.`} />
            {hayIngresos && <Indicador nombre="NRR de ingresos" valor={pct(ing.nrr)} clase={tono(ing.nrr, 1, 0.9)} nota="Lo mismo con la facturación cargada." />}
          </Indicadores>
        </Tarjeta>

        <Tarjeta titulo="Concentración de clientes" col={6} nota="Últimos 3 meses cerrados">
          <Indicadores>
            <Indicador nombre="Cliente más grande" valor={pct(d.concentracion.top1)} clase={tono(d.concentracion.top1, 0.15, 0.25, false)} nota={`${d.concentracion.top1_cliente ?? '—'}. Si un cliente pasa del 25 %, su salida pone en riesgo la operación.`} />
            <Indicador nombre="5 clientes más grandes" valor={pct(d.concentracion.top5)} clase={tono(d.concentracion.top5, 0.5, 0.7, false)} nota="Parte de los servicios que viene de los 5 mayores." />
          </Indicadores>
          <Tabla limite={10} orden="servicios" filas={(d.concentracion.top ?? []).map((x) => ({ cliente: x.cliente, servicios: x.servicios, pct: x.pct }))} columnas={[
            { campo: 'cliente', etiqueta: 'Cliente' },
            { campo: 'servicios', etiqueta: 'Servicios', tipo: 'numero', barra: true },
            { campo: 'pct', etiqueta: '% del total', tipo: 'pct' },
          ]} />
        </Tarjeta>

        <Tarjeta titulo="Retención activa por cohorte" nota="% de los clientes de cada trimestre que siguen activos 1, 3, 6, 12 y 24 meses después de su primer mes activo">
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead>
                <tr>{['Cohorte', 'Clientes', '1 mes', '3 meses', '6 meses', '12 meses', '24 meses'].map((t, i) => <th key={t} className={`${th} ${i > 0 ? 'text-right' : ''}`}>{t}</th>)}</tr>
              </thead>
              <tbody>
                {d.cohortes.map((co) => (
                  <tr key={co.trimestre}>
                    <td className={`${td} whitespace-nowrap font-medium`}>{trimestre(co.trimestre)}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(co.clientes)}</td>
                    {['1', '3', '6', '12', '24'].map((m) => {
                      const v = co.retencion?.[m];
                      return (
                        <td key={m} className={`${td} text-right tabular-nums ${v == null ? 'text-tenue' : v >= 80 ? 'text-bueno' : v < 50 ? 'text-malo' : ''}`}
                          style={v == null ? undefined : { background: `color-mix(in srgb, var(--serie-1) ${Math.round(v * 0.35)}%, transparent)` }}>
                          {v == null ? '·' : `${v} %`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Conversión por etapa" col={6} nota={`Oportunidades de Kommo creadas desde el ${fechaLarga(d.embudo.desde)}`}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead><tr>{['Etapa', 'Oportunidades', 'De la etapa anterior', 'De los leads'].map((t, i) => <th key={t} className={`${th} ${i > 0 ? 'text-right' : ''}`}>{t}</th>)}</tr></thead>
              <tbody>
                {etapas.map((e, i) => (
                  <tr key={e.etapa}>
                    <td className={`${td} font-medium`}>{e.etapa}</td>
                    <td className={`${td} text-right tabular-nums`}>{num(e.oportunidades)}</td>
                    <td className={`${td} text-right tabular-nums`}>{i === 0 ? '—' : pct(etapas[i - 1].oportunidades ? e.oportunidades / etapas[i - 1].oportunidades : null)}</td>
                    <td className={`${td} text-right tabular-nums`}>{pct(leads ? e.oportunidades / leads : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="text-[12.5px] text-suave">Kommo se carga desde septiembre de 2026; una etapa posterior cuenta como haber pasado por las anteriores. Detalle en <Link href="/embudo" className="underline">Embudo</Link>.</span>
        </Tarjeta>

        <Tarjeta titulo="Unidad económica" col={6} nota={`Últimos 90 días · margen bruto supuesto ${pct(d.margen)}`}>
          <Indicadores>
            <Indicador nombre="CAC" valor={cac != null ? pesos(cac) : '—'} nota={`Inversión de marketing (${pesos(k.inversion_90)}) ÷ clientes que decidieron tomar WIP en Kommo (${num(k.clientes_90)}). Ver Costos de marketing.`} />
            <Indicador nombre="Costo por reunión hecha" valor={k.reuniones_90 ? pesos(k.inversion_90 / k.reuniones_90) : '—'} nota={`${num(k.reuniones_90)} reuniones hechas con oportunidades de los últimos 90 días.`} />
            <Indicador nombre="MRR" valor={hayIngresos ? pesos(ing.mrr) : 'Falta facturación'} clase={hayIngresos ? '' : 'text-tenue'} nota={hayIngresos ? `${ult}, ${num(ing.clientes_facturados)} clientes facturados. Mes anterior: ${pesos(ing.mrr_ant)}.` : 'Ingreso mensual recurrente. Se calcula con la facturación por cliente que se carga abajo.'} />
            <Indicador nombre="ARPA" valor={arpa != null ? pesos(arpa) : '—'} clase={arpa != null ? '' : 'text-tenue'} nota="Ingreso promedio por cliente al mes." />
            <Indicador nombre="LTV" valor={ltv != null ? pesos(ltv) : '—'} clase={ltv != null ? '' : 'text-tenue'} nota="ARPA × margen ÷ churn mensual de clientes. Cuánto deja un cliente en toda su vida." />
            <Indicador nombre="LTV / CAC" valor={ltv != null && cac ? veces(ltv / cac) : '—'} clase={ltv != null && cac ? tono(ltv / cac, 3, 1) : 'text-tenue'} nota="Meta: 3 x o más." />
            <Indicador nombre="Recuperación del CAC" valor={meses(payback)} clase={payback != null ? tono(payback, 12, 24, false) : 'text-tenue'} nota="Meses de margen que tarda un cliente en pagar lo que costó conseguirlo. Meta: 12 meses o menos." />
          </Indicadores>
        </Tarjeta>

        <Tarjeta titulo="Facturación por cliente" nota="Con esto se calculan MRR, ARPA, LTV, recuperación del CAC y NRR de ingresos. Un valor por cliente y mes; si ya existe, se reemplaza.">
          <FormularioFactura mes={d.ultimo_mes.slice(0, 7)} clientes={d.lista_clientes ?? []} />
          {d.facturacion.length > 0 ? (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead><tr>{['Mes', 'Cliente', 'Valor', 'Nota', ''].map((t, i) => <th key={i} className={`${th} ${i === 2 ? 'text-right' : ''}`}>{t}</th>)}</tr></thead>
                <tbody>
                  {d.facturacion.map((f) => (
                    <tr key={f.id}>
                      <td className={`${td} whitespace-nowrap`}>{nombreMes(f.mes)}</td>
                      <td className={td}>{f.cliente}</td>
                      <td className={`${td} whitespace-nowrap text-right tabular-nums`}>{f.moneda === 'USD' ? `US$ ${num(f.valor)}` : pesos(f.valor)}</td>
                      <td className={`${td} text-[12px] text-suave`}>{f.nota}</td>
                      <td className={td}><BotonEliminar accion={eliminarFactura} id={f.id} titulo="Borra la facturación de ese mes" pregunta={`¿Eliminar la facturación de ${f.cliente} de ${nombreMes(f.mes)}?`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="text-[12.5px] text-tenue">Todavía no hay facturación cargada.</span>
          )}
        </Tarjeta>
      </Rejilla>
    </>
  );
}
