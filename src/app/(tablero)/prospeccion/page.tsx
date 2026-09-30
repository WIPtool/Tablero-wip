import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Prospeccion } from '@/lib/datos';
import { pct, pesos } from '@/lib/formato';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Prospección' };

const tasa = (a?: number | null, b?: number | null) => (b ? (a ?? 0) / b : null);

export default async function PaginaProspeccion({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Prospeccion>('tablero_prospeccion', { p_desde: rango.desde, p_hasta: rango.hasta });
  const k = d.kpis;

  return (
    <>
      <Encabezado pagina={buscarPagina('prospeccion')!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Correos enviados', valor: k.enviados, anterior: k.enviados_ant, principal: true },
        { etiqueta: 'Respuestas', valor: k.respuestas, anterior: k.respuestas_ant },
        { etiqueta: 'Tasa de respuesta', valor: tasa(k.respuestas, k.enviados), anterior: tasa(k.respuestas_ant, k.enviados_ant), formato: pct },
        { etiqueta: 'Leads calientes', valor: k.leads, anterior: k.leads_ant },
        { etiqueta: 'Gasto (COP)', valor: k.gasto, anterior: k.gasto_ant, formato: pesos },
        { etiqueta: 'Costo por lead caliente', valor: tasa(k.gasto, k.leads), anterior: tasa(k.gasto_ant, k.leads_ant), formato: pesos, menorEsMejor: true },
      ]} />
      <Aviso>
        Explee no entrega cifras por día: se guardan desde el 28 de septiembre de 2026, y todo lo anterior aparece sumado el 1 de septiembre.
        El gasto está en dólares y se pasa a pesos con la TRM del día.
      </Aviso>
      <Rejilla>
        <Tarjeta titulo="Correos y respuestas por día">
          <Leyenda items={[{ etiqueta: 'Correos enviados', color: 'var(--serie-1)' }, { etiqueta: 'Respuestas', color: 'var(--serie-2)' }]} />
          <GraficaPaneles serie={d.serie} paneles={[
            { campo: 'enviados', etiqueta: 'Correos enviados', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'respuestas', etiqueta: 'Respuestas', forma: 'columnas', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Campañas">
          <Tabla total filas={d.campanas} vacio="Sin envíos de Explee en este periodo." columnas={[
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'enviados', etiqueta: 'Enviados', tipo: 'numero', barra: true },
            { campo: 'respuestas', etiqueta: 'Respuestas', tipo: 'numero' },
            { campo: 'tasa_respuesta', etiqueta: 'Tasa de respuesta', tipo: 'pct' },
            { campo: 'leads', etiqueta: 'Leads calientes', tipo: 'numero' },
            { campo: 'gasto', etiqueta: 'Gasto (COP)', tipo: 'pesos' },
            { campo: 'costo_lead', etiqueta: 'Costo por lead', tipo: 'pesos', sinTotal: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Clics a la agenda desde Explee, por campaña" col={6} nota="Enlaces wiptool.com/agenda-explee/…">
          <Tabla total filas={d.agenda_por_campana} vacio="Sin clics a la agenda desde Explee en este periodo." columnas={[
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'clics', etiqueta: 'Clics a la agenda', tipo: 'numero', barra: true },
            { campo: 'personas', etiqueta: 'Personas', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Visitas a la web desde Explee, por campaña" col={6} nota="Enlaces wiptool.com/explee/… y /equipos/explee/…">
          <Tabla total filas={d.visitas_por_campana} vacio="Sin visitas desde Explee en este periodo." columnas={[
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Leads calientes" nota="Personas que respondieron con interés, según Explee.">
          <Tabla orden="fecha" limite={15} filas={d.leads} vacio="Sin leads calientes en este periodo." columnas={[
            { campo: 'fecha', etiqueta: 'Fecha', tipo: 'fecha' },
            { campo: 'empresa', etiqueta: 'Empresa' },
            { campo: 'nombre', etiqueta: 'Nombre' },
            { campo: 'cargo', etiqueta: 'Cargo' },
            { campo: 'pais', etiqueta: 'País' },
            { campo: 'correo', etiqueta: 'Correo' },
            { campo: 'telefono', etiqueta: 'Teléfono' },
            { campo: 'linkedin', etiqueta: 'LinkedIn', tipo: 'enlace' },
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'motivo', etiqueta: 'Qué respondió' },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
