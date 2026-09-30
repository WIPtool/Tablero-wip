import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Seo } from '@/lib/datos';
import { pct, pos, fechaLarga } from '@/lib/formato';
import type { Rango } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

// Página de SEO para un sitio de la propiedad de Search Console (wiptool.com o platform.wiptool.com).
export async function PaginaSeo({ id, sitio, rango }: { id: string; sitio: string; rango: Rango }) {
  const d = await pedir<Seo>('tablero_seo', { p_desde: rango.desde, p_hasta: rango.hasta, p_sitio: sitio });
  const k = d.kpis;
  const ctr = k.impresiones ? (k.clics ?? 0) / k.impresiones : null;
  const ctrAnt = k.impresiones_ant ? (k.clics_ant ?? 0) / k.impresiones_ant : null;

  return (
    <>
      <Encabezado pagina={buscarPagina(id)!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Clics desde Google', valor: k.clics, anterior: k.clics_ant, principal: true },
        { etiqueta: 'Veces que aparecimos (impresiones)', valor: k.impresiones, anterior: k.impresiones_ant },
        { etiqueta: '% que hace clic (CTR)', valor: ctr, anterior: ctrAnt, formato: pct },
        { etiqueta: 'Posición promedio (1 = primero)', valor: k.posicion, anterior: k.posicion_ant, formato: pos, menorEsMejor: true },
      ]} />
      {d.ultimo_dia && d.ultimo_dia < rango.hasta && (
        <Aviso>Google publica estos datos con 2 o 3 días de retraso. El último día disponible es el <strong className="font-semibold">{fechaLarga(d.ultimo_dia)}</strong>.</Aviso>
      )}
      <Rejilla>
        <Tarjeta titulo="Clics e impresiones por día">
          <Leyenda items={[{ etiqueta: 'Clics', color: 'var(--serie-1)' }, { etiqueta: 'Impresiones', color: 'var(--serie-2)' }]} />
          <GraficaPaneles serie={d.serie} paneles={[
            { campo: 'clics', etiqueta: 'Clics', forma: 'linea', color: 'var(--serie-1)' },
            { campo: 'impresiones', etiqueta: 'Impresiones', forma: 'linea', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Búsquedas que nos traen visitas" col={7}>
          <Tabla limite={12} filas={d.consultas} columnas={[
            { campo: 'consulta', etiqueta: 'Búsqueda en Google' },
            { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true },
            { campo: 'impresiones', etiqueta: 'Impresiones', tipo: 'numero' },
            { campo: 'posicion', etiqueta: 'Posición', tipo: 'pos' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Páginas que más aparecen en Google" col={5}>
          <Tabla limite={12} filas={d.paginas} columnas={[
            { campo: 'pagina', etiqueta: 'Página', tipo: 'url-google' },
            { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true },
            { campo: 'impresiones', etiqueta: 'Impresiones', tipo: 'numero' },
            { campo: 'posicion', etiqueta: 'Posición', tipo: 'pos' },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
