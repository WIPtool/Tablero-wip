import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Email } from '@/lib/datos';
import { pct, pesos } from '@/lib/formato';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Email marketing' };

const tasa = (a?: number | null, b?: number | null) => (b ? (a ?? 0) / b : null);

export default async function PaginaEmail({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Email>('tablero_email', { p_desde: rango.desde, p_hasta: rango.hasta });
  const k = d.kpis;
  const clicsCorreos = d.clics_desde_correos.reduce((a, x) => a + x.clics, 0);
  const sinDatos = !k.enviados && !k.enviados_ant && !d.campanas.length;

  return (
    <>
      <Encabezado pagina={buscarPagina('email')!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Correos enviados', valor: k.enviados, anterior: k.enviados_ant, principal: true },
        { etiqueta: 'Tasa de apertura', valor: tasa(k.aperturas, k.entregados), anterior: tasa(k.aperturas_ant, k.entregados_ant), formato: pct },
        { etiqueta: 'Tasa de clics', valor: tasa(k.clics, k.entregados), anterior: tasa(k.clics_ant, k.entregados_ant), formato: pct },
        { etiqueta: 'Clics a WhatsApp y a la agenda', valor: clicsCorreos, nota: 'Desde los enlaces medidos de los correos' },
        { etiqueta: 'Inversión Brevo', valor: k.inversion, anterior: k.inversion_ant, formato: pesos },
      ]} />
      {sinDatos && (
        <Aviso>Todavía no llegan datos de <strong className="font-semibold">Brevo</strong> para este periodo.</Aviso>
      )}
      <Rejilla>
        <Tarjeta titulo="Correos de las automatizaciones por día" nota="Cada correo cuenta una vez por día, aunque se abra varias veces.">
          <Leyenda items={[{ etiqueta: 'Enviados', color: 'var(--serie-1)' }, { etiqueta: 'Abiertos', color: 'var(--serie-2)' }]} />
          <GraficaPaneles serie={d.serie} paneles={[
            { campo: 'enviados', etiqueta: 'Enviados', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'aperturas', etiqueta: 'Abiertos', forma: 'linea', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Automatizaciones" nota="Tasas sobre los correos entregados.">
          <Tabla total filas={d.secuencias} vacio="Sin correos de automatizaciones en este periodo." columnas={[
            { campo: 'secuencia', etiqueta: 'Automatización' },
            { campo: 'enviados', etiqueta: 'Enviados', tipo: 'numero', barra: true },
            { campo: 'entregados', etiqueta: 'Entregados', tipo: 'numero' },
            { campo: 'aperturas', etiqueta: 'Abiertos', tipo: 'numero' },
            { campo: 'tasa_apertura', etiqueta: 'Tasa de apertura', tipo: 'pct' },
            { campo: 'clics', etiqueta: 'Con clic', tipo: 'numero' },
            { campo: 'tasa_clics', etiqueta: 'Tasa de clics', tipo: 'pct' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Correos por asunto">
          <Tabla total filas={d.correos} vacio="Sin correos en este periodo." columnas={[
            { campo: 'asunto', etiqueta: 'Asunto' },
            { campo: 'secuencia', etiqueta: 'Automatización' },
            { campo: 'enviados', etiqueta: 'Enviados', tipo: 'numero', barra: true },
            { campo: 'aperturas', etiqueta: 'Abiertos', tipo: 'numero' },
            { campo: 'tasa_apertura', etiqueta: 'Tasa de apertura', tipo: 'pct' },
            { campo: 'clics', etiqueta: 'Con clic', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Clics desde los correos a WhatsApp y a la agenda" col={6} nota="Por el código ?c= de cada enlace medido.">
          <Tabla total filas={d.clics_desde_correos} vacio="Sin clics desde los correos en este periodo." columnas={[
            { campo: 'correo', etiqueta: 'Correo' },
            { campo: 'clic_a', etiqueta: 'Clic a' },
            { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true },
            { campo: 'personas', etiqueta: 'Personas', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Visitas a la página web desde los correos" col={6} nota="Por la marca utm_content de cada enlace.">
          <Tabla total filas={d.visitas_desde_correos} vacio="Sin visitas desde los correos en este periodo." columnas={[
            { campo: 'correo', etiqueta: 'Correo' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Campañas masivas" nota="Cifras acumuladas de cada campaña, en el día en que se envió.">
          <Tabla total orden="fecha" filas={d.campanas} vacio="Sin campañas masivas enviadas en este periodo." columnas={[
            { campo: 'fecha', etiqueta: 'Envío', tipo: 'fecha' },
            { campo: 'campana', etiqueta: 'Campaña' },
            { campo: 'enviados', etiqueta: 'Enviados', tipo: 'numero' },
            { campo: 'aperturas', etiqueta: 'Aperturas únicas', tipo: 'numero' },
            { campo: 'tasa_apertura', etiqueta: 'Tasa de apertura', tipo: 'pct' },
            { campo: 'clics', etiqueta: 'Clics únicos', tipo: 'numero' },
            { campo: 'tasa_clics', etiqueta: 'Tasa de clics', tipo: 'pct' },
            { campo: 'desuscritos', etiqueta: 'Desuscritos', tipo: 'numero' },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
