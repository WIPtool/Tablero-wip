import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla, type Columna } from '@/componentes/Tabla';
import { pedir, type Pauta } from '@/lib/datos';
import { pesos } from '@/lib/formato';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Pauta' };

export default async function PaginaPauta({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Pauta>('tablero_pauta', { p_desde: rango.desde, p_hasta: rango.hasta });
  const k = d.kpis;
  const costoConv = k.conversaciones ? (k.meta ?? 0) / k.conversaciones : null;
  const costoConvAnt = k.conversaciones_ant ? (k.meta_ant ?? 0) / k.conversaciones_ant : null;

  // Inversión por mes con una columna por plataforma.
  const plataformas = [...new Set(d.por_mes.map((x) => x.plataforma))].sort((a, b) =>
    ['Meta', 'Google Ads'].indexOf(b) - ['Meta', 'Google Ads'].indexOf(a) || a.localeCompare(b, 'es'));
  const meses = new Map<string, Record<string, string | number>>();
  for (const x of d.por_mes) {
    const fila = meses.get(x.mes) ?? { mes: x.mes, total: 0 };
    fila[x.plataforma] = x.inversion;
    fila.total = Number(fila.total) + x.inversion;
    meses.set(x.mes, fila);
  }
  const columnasMes: Columna[] = [
    { campo: 'mes', etiqueta: 'Mes' },
    ...plataformas.map((p) => ({ campo: p, etiqueta: p, tipo: 'pesos' as const })),
    { campo: 'total', etiqueta: 'Total', tipo: 'pesos', barra: true },
  ];
  const sinMeta = !d.campanas_meta.length && !k.meta;
  const sinGads = !d.campanas_gads.length && !k.gads;

  return (
    <>
      <Encabezado pagina={buscarPagina('pauta')!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Total inversión (COP)', valor: k.total, anterior: k.total_ant, formato: pesos, principal: true },
        { etiqueta: 'Inversión Meta', valor: k.meta, anterior: k.meta_ant, formato: pesos },
        { etiqueta: 'Conversaciones de WhatsApp (Meta)', valor: k.conversaciones, anterior: k.conversaciones_ant },
        { etiqueta: 'Costo por conversación', valor: costoConv, anterior: costoConvAnt, formato: pesos, menorEsMejor: true },
        { etiqueta: 'Inversión Google Ads', valor: k.gads, anterior: k.gads_ant, formato: pesos },
      ]} />
      {(sinMeta || sinGads) && (
        <Aviso>
          {sinMeta && <>Todavía no llegan datos de <strong className="font-semibold">Meta Ads</strong>. </>}
          {sinGads && <>Google Ads no tiene inversión en este periodo (o aún no se instala el script que la envía). </>}
          La inversión total incluye los <Link href="/costos" className="underline">costos fijos</Link> en pesos.
        </Aviso>
      )}
      <Rejilla>
        <Tarjeta titulo="Inversión y conversaciones por día" nota="Inversión total en pesos: pauta más costos fijos repartidos por día.">
          <Leyenda items={[{ etiqueta: 'Inversión (COP)', color: 'var(--serie-2)' }, { etiqueta: 'Conversaciones de WhatsApp', color: 'var(--serie-1)' }]} />
          <GraficaPaneles serie={d.serie} paneles={[
            { campo: 'inversion', etiqueta: 'Inversión (COP)', forma: 'columnas', color: 'var(--serie-2)' },
            { campo: 'conversaciones', etiqueta: 'Conversaciones de WhatsApp', forma: 'linea', color: 'var(--serie-1)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Campañas de Meta" col={7} nota="Las conversaciones son los chats de WhatsApp que Meta atribuye a cada campaña.">
          <Tabla total filas={d.campanas_meta} vacio="Sin campañas de Meta en este periodo." columnas={[
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'inversion', etiqueta: 'Inversión', tipo: 'pesos', barra: true },
            { campo: 'clics', etiqueta: 'Clics', tipo: 'numero' },
            { campo: 'conversaciones', etiqueta: 'Conversaciones', tipo: 'numero' },
            { campo: 'costo', etiqueta: 'Costo por conversación', tipo: 'pesos', sinTotal: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Inversión por plataforma" col={5} nota={<Link href="/costos" className="underline">Editar costos fijos</Link>}>
          <Tabla total filas={d.por_plataforma} columnas={[
            { campo: 'plataforma', etiqueta: 'Plataforma' },
            { campo: 'inversion', etiqueta: 'Inversión (COP)', tipo: 'pesos', barra: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Campañas de Google Ads" col={7}>
          <Tabla total filas={d.campanas_gads} vacio="Sin inversión en Google Ads en este periodo." columnas={[
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'inversion', etiqueta: 'Inversión', tipo: 'pesos', barra: true },
            { campo: 'clics', etiqueta: 'Clics', tipo: 'numero' },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
            { campo: 'costo', etiqueta: 'Costo por conversión', tipo: 'pesos', sinTotal: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Inversión por plataforma y mes (COP)" col={5}>
          <Tabla total orden="mes" filas={[...meses.values()]} columnas={columnasMes} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
