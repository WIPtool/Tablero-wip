import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Servicios } from '@/lib/datos';
import { fechaLarga, mesCorto, mesLargo, num } from '@/lib/formato';
import { hoyBogota, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Servicios' };

// Esta página va por meses, no por el periodo de días de Marketing: ?meses=6|12|24|36.
const OPCIONES = [6, 12, 24, 36];
const MESES_TABLA = 6;
const nombreMes = (iso: string) => mesLargo(iso).split(' de ')[0];

export default async function PaginaServicios({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const sp = await searchParams;
  const meses = OPCIONES.includes(Number(sp.meses)) ? Number(sp.meses) : 12;
  const d = await pedir<Servicios>('tablero_servicios', { p_meses: meses });
  const k = d.kpis;
  const hoy = hoyBogota();
  const dia = Number(hoy.slice(8, 10));

  // Servicios por cliente en los últimos meses, un mes por columna (el más reciente a la izquierda).
  const ultimos = d.serie.slice(-MESES_TABLA).map((s) => s.fecha).reverse();
  const clientes = new Map<string, Record<string, string | number>>();
  for (const f of d.por_cliente_mes) {
    const i = ultimos.indexOf(f.mes);
    if (i < 0) continue;
    const fila = clientes.get(f.cliente) ?? { cliente: f.cliente, total: 0 };
    fila['m' + i] = f.servicios;
    fila.total = Number(fila.total) + f.servicios;
    clientes.set(f.cliente, fila);
  }

  return (
    <>
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
        <Encabezado pagina={buscarPagina('servicios')!} />
        <nav aria-label="Meses a mostrar" className="flex flex-wrap gap-1.5">
          {OPCIONES.map((m) => (
            <Link key={m} href={`/servicios?meses=${m}`} aria-current={m === meses ? 'true' : undefined}
              className={`rounded-full border px-3 py-1 text-[13px] font-medium no-underline ${m === meses ? 'border-navy bg-navy text-white dark:border-lima dark:bg-lima dark:text-navy' : 'border-linea text-tinta hover:border-tenue'}`}>
              {m} meses
            </Link>
          ))}
        </nav>
      </div>
      <Cifras items={[
        { etiqueta: `Servicios este mes (${nombreMes(hoy)})`, valor: k.este_mes, anterior: k.este_mes_ant, principal: true },
        { etiqueta: `Mes anterior (${nombreMes(d.serie.at(-2)?.fecha ?? hoy)})`, valor: k.mes_anterior, anterior: k.mes_anterior_ant },
        { etiqueta: 'Promedio mensual (últimos 12 meses)', valor: k.promedio_12, nota: 'Meses completos, sin contar el actual' },
        { etiqueta: 'Clientes con servicios este mes', valor: k.clientes_mes, anterior: k.clientes_mes_ant },
      ]} />
      <Aviso>
        Servicios creados en la plataforma WIP (producción), por fecha de creación en hora de Colombia.
        «Servicios este mes» va del 1 al {dia} y se compara con los mismos días del mes anterior.
        {d.ultimo_dia ? <> Último servicio cargado: {fechaLarga(d.ultimo_dia)}.</> : <> Aún no hay servicios cargados desde la plataforma.</>}
      </Aviso>
      <Rejilla>
        <Tarjeta titulo="Servicios por mes" nota={`${num(k.periodo)} servicios en ${meses} meses · el mes actual va en curso`}>
          <Leyenda items={[{ etiqueta: 'Servicios creados', color: 'var(--serie-1)' }, { etiqueta: 'Clientes con servicios', color: 'var(--serie-2)' }]} />
          <GraficaPaneles porMes serie={d.serie} alto={180} paneles={[
            { campo: 'servicios', etiqueta: 'Servicios creados', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'clientes', etiqueta: 'Clientes con servicios', forma: 'linea', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Servicios por cliente, mes a mes" nota={`Últimos ${ultimos.length} meses`}>
          <Tabla total limite={15} orden="m0" filas={[...clientes.values()]} vacio="Sin servicios en estos meses." columnas={[
            { campo: 'cliente', etiqueta: 'Cliente' },
            ...ultimos.map((m, i) => ({ campo: 'm' + i, etiqueta: mesCorto(m) + (i === 0 ? ' (en curso)' : ''), tipo: 'numero' as const, barra: i === 0 })),
            { campo: 'total', etiqueta: 'Total', tipo: 'numero' as const },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Clientes" col={12} nota={`Promedio = por mes completo de los últimos ${meses} meses`}>
          <Tabla total limite={15} filas={d.por_cliente} vacio="Sin servicios en estos meses." columnas={[
            { campo: 'cliente', etiqueta: 'Cliente' },
            { campo: 'este_mes', etiqueta: 'Este mes', tipo: 'numero', barra: true },
            { campo: 'mes_anterior', etiqueta: 'Mes anterior', tipo: 'numero' },
            { campo: 'promedio', etiqueta: 'Promedio mensual', tipo: 'numero', sinTotal: true },
            { campo: 'periodo', etiqueta: `Total ${meses} meses`, tipo: 'numero' },
            { campo: 'ultimo', etiqueta: 'Último servicio', tipo: 'fecha' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Por tipo de servicio" col={6}>
          <Tabla total filas={d.por_tipo} vacio="Sin servicios en estos meses." columnas={[
            { campo: 'tipo', etiqueta: 'Tipo de servicio' },
            { campo: 'este_mes', etiqueta: 'Este mes', tipo: 'numero' },
            { campo: 'periodo', etiqueta: `${meses} meses`, tipo: 'numero', barra: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Por estado" col={6} nota="Estado actual de cada servicio">
          <Tabla total filas={d.por_estado} vacio="Sin servicios en estos meses." columnas={[
            { campo: 'estado', etiqueta: 'Estado' },
            { campo: 'este_mes', etiqueta: 'Este mes', tipo: 'numero' },
            { campo: 'periodo', etiqueta: `${meses} meses`, tipo: 'numero', barra: true },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
