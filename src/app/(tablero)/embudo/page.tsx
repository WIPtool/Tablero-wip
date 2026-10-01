import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Embudo } from '@/lib/datos';
import { pesos } from '@/lib/formato';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Embudo' };

const costo = (inversion?: number | null, n?: number | null) => (n ? (inversion ?? 0) / n : null);
const dias = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('es-CO')} ${v === 1 ? 'día' : 'días'}`);

export default async function PaginaEmbudo({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Embudo>('tablero_embudo', { p_desde: rango.desde, p_hasta: rango.hasta });
  const k = d.kpis;
  const sinOportunidades = !d.etapas.some((e) => e.oportunidades > 0);
  const sinOrigen = d.por_origen.find((o) => o.origen === 'Sin origen');

  return (
    <>
      <Encabezado pagina={buscarPagina('embudo')!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Oportunidades nuevas', valor: k.nuevas, anterior: k.nuevas_ant, principal: true },
        { etiqueta: 'Reuniones agendadas', valor: k.agendadas, anterior: k.agendadas_ant },
        { etiqueta: 'Reuniones hechas', valor: k.hechas, anterior: k.hechas_ant },
        { etiqueta: 'Clientes nuevos', valor: k.clientes, anterior: k.clientes_ant },
        { etiqueta: 'Costo por reunión agendada', valor: costo(k.inversion, k.agendadas), anterior: costo(k.inversion_ant, k.agendadas_ant), formato: pesos, menorEsMejor: true },
        { etiqueta: 'Costo por cliente', valor: costo(k.inversion, k.clientes), anterior: costo(k.inversion_ant, k.clientes_ant), formato: pesos, menorEsMejor: true },
      ]} />
      {sinOportunidades && (
        <Aviso>
          Todavía no hay oportunidades en <strong className="font-semibold">Kommo</strong>. Aparecen aquí cuando entren los primeros chats de WhatsApp
          o se creen a mano. El costo usa la inversión total del periodo (pauta, Explee y costos fijos).
        </Aviso>
      )}
      {!sinOportunidades && sinOrigen && (
        <Aviso>
          {sinOrigen.nuevas} oportunidades nuevas no tienen <strong className="font-semibold">Origen</strong> en Kommo.
          Llenar ese campo en cada oportunidad es lo que permite saber cuánto cuesta cada reunión y cada cliente según de dónde llegó.
        </Aviso>
      )}
      <Rejilla>
        <Tarjeta titulo="Oportunidades nuevas y reuniones agendadas por día">
          <Leyenda items={[{ etiqueta: 'Oportunidades nuevas', color: 'var(--serie-1)' }, { etiqueta: 'Reuniones agendadas', color: 'var(--serie-2)' }]} />
          <GraficaPaneles serie={d.serie} paneles={[
            { campo: 'nuevas', etiqueta: 'Oportunidades nuevas', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'agendadas', etiqueta: 'Reuniones agendadas', forma: 'columnas', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Por origen" nota="La inversión de cada plataforma se cruza con el origen de las oportunidades.">
          <Tabla total filas={d.por_origen} vacio="Sin oportunidades en este periodo." columnas={[
            { campo: 'origen', etiqueta: 'Origen' },
            { campo: 'nuevas', etiqueta: 'Nuevas', tipo: 'numero', barra: true },
            { campo: 'agendadas', etiqueta: 'Reuniones agendadas', tipo: 'numero' },
            { campo: 'hechas', etiqueta: 'Reuniones hechas', tipo: 'numero' },
            { campo: 'clientes', etiqueta: 'Clientes', tipo: 'numero' },
            { campo: 'inversion', etiqueta: 'Inversión', tipo: 'pesos' },
            { campo: 'costo_reunion', etiqueta: 'Costo por reunión', tipo: 'pesos', sinTotal: true },
            { campo: 'costo_cliente', etiqueta: 'Costo por cliente', tipo: 'pesos', sinTotal: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Cómo está el embudo hoy" col={7} nota="Oportunidades en cada etapa ahora mismo.">
          <Tabla total orden="orden" ascendente filas={d.etapas.map((e, i) => ({ ...e, orden: i }))} columnas={[
            { campo: 'etapa', etiqueta: 'Etapa' },
            { campo: 'oportunidades', etiqueta: 'Oportunidades', tipo: 'numero', barra: true },
            { campo: 'valor', etiqueta: 'Valor', tipo: 'pesos' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Tiempo promedio desde que entra" col={5} nota="De las oportunidades que llegaron a cada etapa en el periodo.">
          <dl className="flex flex-col">
            {[['Hasta reunión agendada', d.tiempos.a_agendada], ['Hasta reunión hecha', d.tiempos.a_hecha], ['Hasta ser cliente', d.tiempos.a_cliente]].map(([t, v]) => (
              <div key={t as string} className="flex items-baseline justify-between gap-4 border-b border-reja py-2.5 last:border-0">
                <dt className="text-[13px] text-suave">{t}</dt>
                <dd className="font-display text-xl font-bold tabular-nums">{dias(v as number | null)}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
        <Tarjeta titulo="Oportunidades nuevas del periodo" col={8}>
          <Tabla orden="fecha" limite={15} filas={d.recientes} vacio="Sin oportunidades nuevas en este periodo." columnas={[
            { campo: 'fecha', etiqueta: 'Fecha', tipo: 'fecha' },
            { campo: 'nombre', etiqueta: 'Oportunidad' },
            { campo: 'etapa', etiqueta: 'Etapa' },
            { campo: 'origen', etiqueta: 'Origen' },
            { campo: 'responsable', etiqueta: 'Responsable' },
            { campo: 'valor', etiqueta: 'Valor', tipo: 'pesos' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Perdidas por motivo" col={4}>
          <Tabla total filas={d.perdidas} vacio="Sin oportunidades perdidas en este periodo." columnas={[
            { campo: 'motivo', etiqueta: 'Motivo' },
            { campo: 'oportunidades', etiqueta: 'Oportunidades', tipo: 'numero', barra: true },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
