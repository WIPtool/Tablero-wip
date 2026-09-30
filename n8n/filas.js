// n8n · F12 · nodos "Filas Google" y "Filas Meta" (Code, una vez por elemento).
// Convierte la respuesta de cada API en filas de la tabla de Supabase y arma la llamada a cargar().
const t = $('__TRABAJOS__').item.json; // el nombre lo pone armar-flujo.cjs
const r = $json;

const fecha = (s) => (s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);
const paises = new Intl.DisplayNames(['es'], { type: 'region' });
const pais = (id) => { if (!id || id === '(not set)') return '(sin país)'; try { return paises.of(id) || id; } catch (e) { return id; } };

// Suma las filas que comparten la misma clave (evita claves repetidas al insertar).
function agrupar(filas, claves, sumas) {
  const m = new Map();
  for (const f of filas) {
    const k = claves.map((c) => f[c]).join('\u0001');
    const a = m.get(k);
    if (a) sumas.forEach((s) => { a[s] += f[s]; }); else m.set(k, { ...f });
  }
  return [...m.values()];
}

let filas = [];
if (t.fuente === 'ga4') {
  const dn = (r.dimensionHeaders || []).map((h) => h.name);
  const mn = (r.metricHeaders || []).map((h) => h.name);
  const regs = (r.rows || []).map((row) => {
    const o = {};
    dn.forEach((n, i) => { o[n] = row.dimensionValues[i].value; });
    mn.forEach((n, i) => { o[n] = Math.round(Number(row.metricValues[i].value) || 0); });
    return o;
  });
  const v = (x) => (x == null ? '' : String(x));
  if (t.tabla === 'ga4_canal_diario') {
    filas = agrupar(regs.map((o) => ({
      fecha: fecha(o.date), canal: v(o.sessionDefaultChannelGroup), fuente: v(o.sessionSource), medio: v(o.sessionMedium),
      campana: v(o.sessionCampaignName), contenido: v(o.sessionManualAdContent), termino: v(o.sessionManualTerm),
      visitas: o.sessions, conversiones: o.keyEvents,
    })), ['fecha', 'canal', 'fuente', 'medio', 'campana', 'contenido', 'termino'], ['visitas', 'conversiones']);
  } else if (t.tabla === 'ga4_evento_diario') {
    filas = agrupar(regs.map((o) => ({
      fecha: fecha(o.date), evento: v(o.eventName), origen: v(o['customEvent:origen']), correo: v(o['customEvent:correo']),
      eventos: o.eventCount, conversiones: o.keyEvents, personas: o.totalUsers,
    })), ['fecha', 'evento', 'origen', 'correo'], ['eventos', 'conversiones', 'personas']);
  } else if (t.tabla === 'ga4_pagina_diario') {
    filas = agrupar(regs.map((o) => ({ fecha: fecha(o.date), pagina: v(o.landingPage) || '(sin página)', visitas: o.sessions, conversiones: o.keyEvents })),
      ['fecha', 'pagina'], ['visitas', 'conversiones']);
  } else if (t.tabla === 'ga4_audiencia_diario') {
    filas = agrupar(regs.map((o) => ({ fecha: fecha(o.date), pais: pais(o.countryId), dispositivo: v(o.deviceCategory), visitas: o.sessions, conversiones: o.keyEvents })),
      ['fecha', 'pais', 'dispositivo'], ['visitas', 'conversiones']);
  }
} else if (t.fuente === 'meta') {
  // Una fila por día y campaña (time_increment=1). Las conversaciones son los chats de WhatsApp iniciados.
  const conversaciones = (acciones) => Math.round(Number(((acciones || []).find((a) => a.action_type === 'onsite_conversion.messaging_conversation_started_7d') || {}).value) || 0);
  filas = agrupar((r.data || []).map((x) => ({
    fecha: x.date_start, campana_id: String(x.campaign_id), campana: x.campaign_name || '', moneda: x.account_currency || 'COP',
    inversion: Number(x.spend) || 0, impresiones: Math.round(Number(x.impressions) || 0), clics: Math.round(Number(x.clicks) || 0),
    conversaciones: conversaciones(x.actions),
  })), ['fecha', 'campana_id'], ['inversion', 'impresiones', 'clics', 'conversaciones']);
} else {
  const campo = t.tabla === 'gsc_pagina_diario' ? 'pagina' : 'consulta';
  filas = agrupar((r.rows || []).map((x) => ({
    fecha: x.keys[0], sitio: t.sitio, [campo]: x.keys[1],
    clics: Math.round(x.clicks || 0), impresiones: Math.round(x.impressions || 0), pos_x_imp: (x.position || 0) * (x.impressions || 0),
  })), ['fecha', 'sitio', campo], ['clics', 'impresiones', 'pos_x_imp']);
}

return { json: { p_tabla: t.tabla, p_desde: t.desde, p_hasta: t.hasta, p_filas: filas, p_fuente: t.fuente, p_sitio: t.sitio } };
