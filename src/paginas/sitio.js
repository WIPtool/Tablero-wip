import { pedir } from '../datos.js';
import { tarjeta, errorHtml } from '../componentes.js';
import { tabla } from '../tabla.js';
import { esc } from '../formato.js';

const enlace = (ruta) => ruta && ruta.startsWith('/')
  ? `<a href="https://www.wiptool.com${esc(ruta)}" target="_blank" rel="noopener">${esc(ruta)}</a>` : esc(ruta || '(sin página)');

export default {
  id: 'sitio',
  titulo: 'Sitio web',
  sub: 'Qué hace la gente en wiptool.com',
  async render(main, rango, vigente) {
    main.innerHTML = '<div class="rejilla">' +
      tarjeta({ id: 's-paginas', titulo: 'Páginas por las que entra la gente', col: 7,
        nota: '“(not set)” son clics de enlaces medidos que no abren una página del sitio.' }) +
      tarjeta({ id: 's-disp', titulo: 'Celular o computador', col: 5 }) +
      tarjeta({ id: 's-paises', titulo: 'Países', col: 5 }) +
      `<section class="tarjeta c-7"><header><h2>Grabaciones y mapas de calor</h2></header>
        <p class="nota">Para ver cómo usa la gente cada página (dónde hace clic, hasta dónde baja), abre Microsoft Clarity.</p>
        <a class="mas" href="https://clarity.microsoft.com/projects/view/ync4pxhjqu/dashboard" target="_blank" rel="noopener">Abrir Clarity ↗</a></section>` +
      '</div>';
    let d;
    try { d = await pedir('tablero_sitio', { p_desde: rango.desde, p_hasta: rango.hasta }); }
    catch (e) { if (vigente()) main.innerHTML = errorHtml(e); return; }
    if (!vigente()) return;

    tabla(main.querySelector('#s-paginas'), {
      columnas: [{ campo: 'pagina', etiqueta: 'Página de entrada', formato: enlace },
        { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true }, { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' }],
      filas: d.paginas, limite: 12,
    });
    tabla(main.querySelector('#s-disp'), {
      columnas: [{ campo: 'dispositivo', etiqueta: 'Dispositivo' }, { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
        { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' }],
      filas: d.dispositivos, total: true,
    });
    tabla(main.querySelector('#s-paises'), {
      columnas: [{ campo: 'pais', etiqueta: 'País' }, { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
        { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' }],
      filas: d.paises,
    });
  },
};
