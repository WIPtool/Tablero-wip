import { pedir } from '../datos.js';
import { cifras, cifrasCargando, tarjeta, leyenda, errorHtml } from '../componentes.js';
import { graficaPaneles } from '../graficas.js';
import { tabla } from '../tabla.js';

// Nombres legibles de los eventos clave de Analytics.
const EVENTOS = {
  click_whatsapp: 'Clic a WhatsApp', click_calendly: 'Clic a la agenda', formulario_contacto: 'Formulario de contacto',
  inscripcion_enviada: 'Inscripción a un plan', generate_lead: 'Lead (formulario o ebook)', calendly_agendado: 'Cita agendada',
};

export default {
  id: 'resumen',
  titulo: 'Resumen',
  sub: 'Visitas al sitio, conversiones y de dónde llegan',
  async render(main, rango, vigente) {
    main.innerHTML = cifrasCargando(5) + '<div class="rejilla">' +
      tarjeta({ id: 'r-serie', titulo: 'Visitas y conversiones por día', col: 12,
        contenido: '' }) +
      tarjeta({ id: 'r-canales', titulo: 'De dónde llegan las visitas', col: 7,
        nota: '“Directo” son visitas sin origen conocido: enlaces compartidos a mano o escritos en el navegador.' }) +
      tarjeta({ id: 'r-tipos', titulo: 'Conversiones por tipo', col: 5 }) +
      tarjeta({ id: 'r-clics', titulo: 'Clics a WhatsApp y a la agenda por origen', col: 7,
        nota: 'Incluye los enlaces medidos (/wa-ig, /agenda-explee…) y los botones del sitio.' }) +
      tarjeta({ id: 'r-citas', titulo: 'Citas agendadas por origen', col: 5 }) +
      tarjeta({ id: 'r-app', titulo: 'App sin app por cliente', col: 6,
        nota: 'Visitas desde el mensaje de WhatsApp “experiencia app sin app”.' }) +
      '</div>';

    let d;
    try {
      d = await pedir('tablero_resumen', { p_desde: rango.desde, p_hasta: rango.hasta });
    } catch (e) { if (vigente()) main.innerHTML = errorHtml(e); return; }
    if (!vigente()) return;

    const k = d.kpis;
    main.querySelector('.cifras').outerHTML = cifras([
      { etiqueta: 'Conversiones del sitio', valor: k.conversiones, anterior: k.conversiones_ant, principal: true },
      { etiqueta: 'Visitas al sitio', valor: k.visitas, anterior: k.visitas_ant },
      { etiqueta: 'Clics desde Google', valor: k.clics_google, anterior: k.clics_google_ant },
      { etiqueta: 'Apariciones en Google', valor: k.impresiones, anterior: k.impresiones_ant },
      { etiqueta: 'Total inversión (COP)', pendiente: 'Llega en T2', nota: 'Meta, Google Ads y herramientas, en pesos' },
    ]);

    const caja = main.querySelector('#r-serie');
    caja.innerHTML = leyenda([{ etiqueta: 'Visitas', color: 'var(--serie-1)' }, { etiqueta: 'Conversiones', color: 'var(--serie-2)' }]) +
      '<div class="lienzo"></div>';
    graficaPaneles(caja.querySelector('.lienzo'), d.serie, [
      { campo: 'visitas', etiqueta: 'Visitas', forma: 'linea', color: 'var(--serie-1)' },
      { campo: 'conversiones', etiqueta: 'Conversiones', forma: 'columnas', color: 'var(--serie-2)' },
    ]);

    tabla(main.querySelector('#r-canales'), {
      columnas: [{ campo: 'canal', etiqueta: 'Canal' }, { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
        { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' }],
      filas: d.canales, total: true,
    });
    tabla(main.querySelector('#r-tipos'), {
      columnas: [{ campo: 'nombre', etiqueta: 'Tipo' }, { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero', barra: true }],
      filas: d.conversiones_por_tipo.map((t) => ({ nombre: EVENTOS[t.tipo] || t.tipo, conversiones: t.conversiones })), total: true,
    });
    tabla(main.querySelector('#r-clics'), {
      columnas: [{ campo: 'origen', etiqueta: 'Origen' }, { campo: 'clic_a', etiqueta: 'Clic a' },
        { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true }, { campo: 'personas', etiqueta: 'Personas', tipo: 'numero' }],
      filas: d.clics_por_origen, total: true,
    });
    tabla(main.querySelector('#r-citas'), {
      columnas: [{ campo: 'origen', etiqueta: 'Origen' }, { campo: 'citas', etiqueta: 'Citas', tipo: 'numero', barra: true },
        { campo: 'personas', etiqueta: 'Personas', tipo: 'numero' }],
      filas: d.citas_por_origen, total: true,
      vacio: 'Aún no hay citas agendadas en este periodo. Se registran cuando alguien termina de agendar en Calendly.',
    });
    tabla(main.querySelector('#r-app'), {
      columnas: [{ campo: 'cliente', etiqueta: 'Cliente' }, { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
        { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' }],
      filas: d.app_sin_app,
    });
  },
};
