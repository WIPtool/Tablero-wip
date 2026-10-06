// n8n · F12 · anuncios activos de Meta con su texto (tabla meta_anuncio). armar-flujo.cjs toma cada parte por su marca "// ==".
// Los chats de los anuncios llegan a Kommo con utm_campaign = campaña y utm_content = nombre del anuncio; el agente de WhatsApp
// busca aquí el texto del anuncio para saber qué vio la persona. Se agregan cada hora los anuncios activos (la tabla acumula).

// == Trabajos anuncios Meta (Code, una vez para todos los elementos)
const CUENTA = 'act_1212455492189816';
const qs = Object.entries({
  fields: 'name,effective_status,campaign{name},adset{name},creative{title,body,object_story_spec,asset_feed_spec}',
  filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PENDING_REVIEW', 'IN_PROCESS'] }]),
  limit: '200', // con solo los activos son unos 60; WITH_ISSUES traía 140 anuncios viejos de 2021 y llenaba el cupo
}).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
return [{ json: { url: `https://graph.facebook.com/v23.0/${CUENTA}/ads?${qs}` } }];

// == Filas anuncios Meta (Code, una vez para todos los elementos)
// Junta el título y el texto del anuncio, estén donde estén (anuncio normal, de video o con varias versiones de texto).
const r = $input.first().json;
const anuncios = r.data || [];
const textoDe = (c) => {
  if (!c) return '';
  const oss = c.object_story_spec || {};
  const ld = oss.link_data || {}, vd = oss.video_data || {};
  const afs = c.asset_feed_spec || {};
  const partes = [c.title, c.body, ld.name, ld.message, ld.description, vd.title, vd.message,
    ...(afs.titles || []).map((x) => x.text), ...(afs.bodies || []).map((x) => x.text)];
  return [...new Set(partes.map((x) => String(x || '').trim()).filter(Boolean))].join(' · ').slice(0, 800);
};
const filas = anuncios.map((a) => ({
  fecha: null, anuncio_id: String(a.id), nombre: a.name || '', campana: (a.campaign && a.campaign.name) || '',
  conjunto: (a.adset && a.adset.name) || '', estado: a.effective_status || '', texto: textoDe(a.creative),
}));
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
return [{ json: { p_tabla: 'meta_anuncio', p_desde: hoy, p_hasta: hoy, p_filas: filas, p_fuente: null, p_sitio: null } }];
