// n8n · F19 · recordatorio de la demo virtual 20 minutos antes, con confirmación de asistencia. armar-flujo.cjs toma cada parte
// por su marca "// ==" y reemplaza __SUPABASE__, __BOT_DEMO_20__ (Salesbot que envía la plantilla "Recordatorio demo 20 min WIP")
// y __CAMPO_ENLACE__ (oportunidad: "Enlace de reunión", la variable de la plantilla).
// Cada hora (a los :10, de 6 a. m. a 6 p. m.) busca las reuniones que empiezan entre 20 y 80 minutos después:
//  - Calendly: la oportunidad sale de calendly_kommo (las citas que F2 ya pasó a Kommo) y el enlace de location.join_url.
//  - Google Calendar (si hay credencial): reuniones creadas a mano con Meet, Teams o Zoom; la oportunidad sale del correo de un
//    invitado que no sea de @wiptool.com. Las que creó Calendly se saltan (ya van por la otra rama).
// Luego espera, una por una, hasta 20 minutos antes de cada reunión, pone el enlace en la oportunidad y corre el Salesbot.
// Las ventanas de cada hora no se cruzan (20 a 80 minutos), así que cada reunión se avisa una sola vez.

// == Ventana de la demo (Code, una vez para todos los elementos)
const desde = new Date(Date.now() + 20 * 60000).toISOString();
const hasta = new Date(Date.now() + 80 * 60000).toISOString();
const usuario = ($input.first().json.resource || {}).uri;
if (!usuario) return [];
return [{ json: { desde, hasta,
  url: `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(usuario)}&status=active&count=100&min_start_time=${encodeURIComponent(desde)}&max_start_time=${encodeURIComponent(hasta)}` } }];

// == Pedido registro (Code, una vez para todos los elementos)
// Las oportunidades de Kommo de esas citas (si no hay citas, una consulta que no trae nada, para seguir con Google Calendar).
const SUPABASE = '__SUPABASE__';
const uris = ($input.first().json.collection || []).map((c) => c.uri);
const filtro = uris.length ? `in.(${uris.map((u) => '"' + u + '"').join(',')})` : 'eq.ninguno';
return [{ json: { url: `${SUPABASE}/rest/v1/calendly_kommo?select=evento,kommo_lead_id&kommo_lead_id=not.is.null&evento=${encodeURIComponent(filtro)}` } }];

// == Invitados a buscar (Code, una vez para todos los elementos)
// Reuniones de Google Calendar con enlace virtual, sin Calendly: un pedido a Kommo por cada invitado externo.
const correos = new Set();
for (const ev of ($input.first().json.items || [])) {
  if (ev.status === 'cancelled' || /calendly\.com/i.test(ev.description || '')) continue;
  for (const p of (ev.attendees || [])) {
    const correo = String(p.email || '').trim().toLowerCase();
    if (correo && !p.resource && !correo.endsWith('@wiptool.com') && p.responseStatus !== 'declined') correos.add(correo);
  }
}
const K = 'https://wiptool.kommo.com/api/v4/contacts?with=leads&limit=10&query=';
if (!correos.size) return [{ json: { url: K + 'ninguno-' + Date.now() } }];
return [...correos].map((correo) => ({ json: { correo, url: K + encodeURIComponent(correo) } }));

// == Armar recordatorios 20 min (Code, una vez para todos los elementos)
const BOT_DEMO_20 = __BOT_DEMO_20__;
const CAMPO_ENLACE = __CAMPO_ENLACE__;
const leerKommo = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const nodo = (n) => { try { return $(n).all().map((i) => i.json); } catch (e) { return []; } };
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', timeStyle: 'short' });
const porLead = new Map();
const enlaces = new Set();
const agregar = (lead_id, inicio, enlace, fuente) => {
  if (!lead_id || !enlace || porLead.has(Number(lead_id))) return;
  enlaces.add(enlace);
  porLead.set(Number(lead_id), { lead_id: Number(lead_id), inicio, enlace, fuente,
    envio: new Date(new Date(inicio).getTime() - 20 * 60000).toISOString(),
    lead: [{ id: Number(lead_id), custom_fields_values: [{ field_id: CAMPO_ENLACE, values: [{ value: enlace }] }] }],
    bot: [{ bot_id: BOT_DEMO_20, entity_id: Number(lead_id), entity_type: 2 }],
    guardar: { lead_id: Number(lead_id), rol: 'agente', tipo: 'recordatorio', momento: new Date(new Date(inicio).getTime() - 20 * 60000).toISOString(),
      texto: `Hola ✋ Tu demo con WIP empieza en 20 minutos (${hora.format(new Date(inicio))}). Conéctate aquí: ${enlace} ¿Nos confirmas tu asistencia? [Plantilla de WhatsApp con botones "Sí, asistiré" y "Necesito reprogramar"]` } });
};
// Calendly: solo las citas con enlace de videollamada (Meet, Zoom, Teams).
const citas = (nodo('Citas Calendly')[0] || {}).collection || [];
const registro = nodo('Registro citas (demo)').filter((r) => r.evento && r.kommo_lead_id);
for (const c of citas) {
  const enlace = c.location && c.location.join_url;
  const r = registro.find((x) => x.evento === c.uri);
  if (r) agregar(r.kommo_lead_id, c.start_time, enlace, 'Calendly');
}
// Google Calendar: enlace de Meet (hangoutLink o conferenceData) o de Teams/Zoom en el lugar o la descripción.
const eventos = (nodo('Eventos Google Calendar')[0] || {}).items || [];
const contactos = nodo('Contacto en Kommo (demo)').map(leerKommo).flatMap((r) => (r._embedded && r._embedded.contacts) || []);
const correosDe = (c) => (c.custom_fields_values || []).filter((f) => f.field_code === 'EMAIL').flatMap((f) => f.values || []).map((v) => String(v.value).trim().toLowerCase());
for (const ev of eventos) {
  if (ev.status === 'cancelled' || /calendly\.com/i.test(ev.description || '')) continue;
  const inicio = ev.start && ev.start.dateTime;
  if (!inicio) continue; // eventos de todo el día
  const video = ((ev.conferenceData && ev.conferenceData.entryPoints) || []).find((p) => p.entryPointType === 'video');
  const texto = `${ev.location || ''} ${ev.description || ''}`;
  const enlace = ev.hangoutLink || (video && video.uri) || (texto.match(/https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|[\w.-]*zoom\.us)\/[^\s"<>]+/i) || [])[0];
  if (!enlace || enlaces.has(enlace)) continue;
  for (const p of (ev.attendees || [])) {
    const correo = String(p.email || '').trim().toLowerCase();
    if (!correo || correo.endsWith('@wiptool.com') || p.responseStatus === 'declined') continue;
    const contacto = contactos.find((c) => correosDe(c).includes(correo));
    const leads = ((contacto && contacto._embedded && contacto._embedded.leads) || []).map((l) => Number(l.id));
    if (leads.length) { agregar(Math.max(...leads), inicio, enlace, 'Google Calendar'); break; }
  }
}
return [...porLead.values()].sort((x, y) => x.envio.localeCompare(y.envio)).map((json) => ({ json }));
