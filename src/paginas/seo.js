import { pedir } from '../datos.js';
import { cifras, cifrasCargando, tarjeta, leyenda, errorHtml } from '../componentes.js';
import { graficaPaneles } from '../graficas.js';
import { tabla } from '../tabla.js';
import { pct, pos, esc, fechaLarga } from '../formato.js';

function pagina({ id, sitio, titulo, sub }) {
  const corta = (url) => {
    // Del dominio principal se muestra solo la ruta; de cualquier otra variante (sin www, http…), la dirección completa.
    const u = String(url);
    const principal = /^https:\/\/(www\.wiptool\.com|platform\.wiptool\.com)(\/|$)/.test(u);
    const ruta = principal ? u.replace(/^https:\/\/[^/]+/, '') || '/' : u.replace(/^https:\/\//, '');
    return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(ruta)}</a>`;
  };
  return {
    id, titulo, sub,
    async render(main, rango, vigente) {
      main.innerHTML = cifrasCargando(4) + '<div id="seo-aviso"></div><div class="rejilla">' +
        tarjeta({ id: 'g-serie', titulo: 'Clics e impresiones por día', col: 12 }) +
        tarjeta({ id: 'g-consultas', titulo: 'Búsquedas que nos traen visitas', col: 7 }) +
        tarjeta({ id: 'g-paginas', titulo: 'Páginas que más aparecen en Google', col: 5 }) +
        '</div>';
      let d;
      try { d = await pedir('tablero_seo', { p_desde: rango.desde, p_hasta: rango.hasta, p_sitio: sitio }); }
      catch (e) { if (vigente()) main.innerHTML = errorHtml(e); return; }
      if (!vigente()) return;

      const k = d.kpis;
      const ctr = k.impresiones ? k.clics / k.impresiones : null;
      const ctrAnt = k.impresiones_ant ? k.clics_ant / k.impresiones_ant : null;
      main.querySelector('.cifras').outerHTML = cifras([
        { etiqueta: 'Clics desde Google', valor: k.clics, anterior: k.clics_ant, principal: true },
        { etiqueta: 'Veces que aparecimos (impresiones)', valor: k.impresiones, anterior: k.impresiones_ant },
        { etiqueta: '% que hace clic (CTR)', valor: ctr, anterior: ctrAnt, formato: pct },
        { etiqueta: 'Posición promedio (1 = primero)', valor: k.posicion, anterior: k.posicion_ant, formato: pos, menorEsMejor: true },
      ]);
      if (d.ultimo_dia && d.ultimo_dia < rango.hasta) {
        main.querySelector('#seo-aviso').innerHTML = `<div class="aviso"><div>Google publica estos datos con 2 o 3 días de retraso. ` +
          `El último día disponible es el <strong>${esc(fechaLarga(d.ultimo_dia))}</strong>.</div></div>`;
      }
      const caja = main.querySelector('#g-serie');
      caja.innerHTML = leyenda([{ etiqueta: 'Clics', color: 'var(--serie-1)' }, { etiqueta: 'Impresiones', color: 'var(--serie-2)' }]) +
        '<div class="lienzo"></div>';
      graficaPaneles(caja.querySelector('.lienzo'), d.serie, [
        { campo: 'clics', etiqueta: 'Clics', forma: 'linea', color: 'var(--serie-1)' },
        { campo: 'impresiones', etiqueta: 'Impresiones', forma: 'linea', color: 'var(--serie-2)' },
      ]);
      tabla(main.querySelector('#g-consultas'), {
        columnas: [{ campo: 'consulta', etiqueta: 'Búsqueda en Google' }, { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true },
          { campo: 'impresiones', etiqueta: 'Impresiones', tipo: 'numero' }, { campo: 'posicion', etiqueta: 'Posición', tipo: 'pos' }],
        filas: d.consultas, limite: 12,
      });
      tabla(main.querySelector('#g-paginas'), {
        columnas: [{ campo: 'pagina', etiqueta: 'Página', formato: corta }, { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true },
          { campo: 'impresiones', etiqueta: 'Impresiones', tipo: 'numero' }, { campo: 'posicion', etiqueta: 'Posición', tipo: 'pos' }],
        filas: d.paginas, limite: 12,
      });
    },
  };
}

export const seoSitio = pagina({ id: 'seo', sitio: 'wiptool.com', titulo: 'SEO sitio web', sub: 'Cómo nos encuentran en Google: wiptool.com' });
export const seoPlataforma = pagina({ id: 'seo-plataforma', sitio: 'platform.wiptool.com', titulo: 'SEO plataforma', sub: 'Cómo nos encuentran en Google: platform.wiptool.com' });
