// n8n · F12 · nodo "Filas Brevo" (Code, una vez para todos los elementos).
// Junta las páginas de eventos de todos los días en una sola carga (mensajes distintos por día, asunto y evento)
// y arma aparte la carga de las campañas masivas.
const trabajos = $('Trabajos Brevo').all();
const respuestas = $input.all();
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });

const salida = [];
const grupos = new Map();
let rango = null;

respuestas.forEach((r, i) => {
  const t = trabajos[i].json;
  if (t.tabla === 'brevo_evento_diario') {
    rango = { desde: t.desde, hasta: t.hasta };
    const ev = r.json.events || [];
    if (t.ultima && ev.length >= t.limite) throw new Error(`Brevo tiene más de ${(t.pagina + 1) * t.limite} eventos el ${t.dia}: hay que subir PAGINAS en "Trabajos Brevo"`);
    for (const e of ev) {
      const f = dia.format(new Date(e.date));
      if (f < t.desde || f > t.hasta) continue;
      const k = [f, String(e.subject || '').trim(), e.event].join('\u0001');
      if (!grupos.has(k)) grupos.set(k, new Set());
      grupos.get(k).add(e.messageId || `${e.email}|${e.date}`);
    }
  } else {
    // Campañas masivas enviadas, con sus cifras acumuladas.
    const filas = (r.json.campaigns || []).filter((c) => c.sentDate).map((c) => {
      const s = (c.statistics && c.statistics.globalStats) || {};
      return { fecha: dia.format(new Date(c.sentDate)), campana_id: String(c.id), campana: c.name || '', asunto: c.subject || '',
        enviados: Math.round(s.sent || 0), entregados: Math.round(s.delivered || 0), aperturas: Math.round(s.uniqueViews || 0),
        clics: Math.round(s.uniqueClicks || 0), desuscritos: Math.round(s.unsubscriptions || 0),
        rebotes: Math.round((s.hardBounces || 0) + (s.softBounces || 0)) };
    });
    salida.push({ json: { p_tabla: 'brevo_campana', p_desde: t.desde, p_hasta: t.hasta, p_filas: filas, p_fuente: 'brevo', p_sitio: null } });
  }
});

if (rango) {
  const filas = [...grupos.entries()].map(([k, ids]) => { const [f, asunto, evento] = k.split('\u0001'); return { fecha: f, asunto, evento, mensajes: ids.size }; });
  salida.unshift({ json: { p_tabla: 'brevo_evento_diario', p_desde: rango.desde, p_hasta: rango.hasta, p_filas: filas, p_fuente: 'brevo', p_sitio: null } });
}
return salida;
