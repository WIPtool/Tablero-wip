// n8n · F18 · Brevo avisa a Kommo en qué secuencia de correos está cada persona. armar-flujo.cjs toma cada parte por su marca "// ==".
// Brevo (webhook de marketing) llama este flujo cuando un contacto se añade a una lista o se da de baja:
//  - lista "Info solicitada" (9)      → oportunidad: Secuencia Brevo = Info solicitada
//  - lista "Nutricion - General" (21) → oportunidad: Secuencia Brevo = Nutrición
//  - baja de los correos              → oportunidad: Secuencia Brevo = Desuscrito, y contacto: Suscripción de marketing = Desuscrito
// Se busca el contacto de Kommo por su correo y se marca su oportunidad más reciente, con una nota.

// == Evento de Brevo (Code, una vez para todos los elementos)
const LISTAS = { 9: 'Info solicitada', 21: 'Nutrición' };
const b = $input.first().json.body || {};
const evento = String(b.event || '').toLowerCase();
const correo = String(b.email || '').trim().toLowerCase();
const listas = [].concat(b.list_id ?? b.listId ?? b.list_ids ?? []).map(Number);
let estado = null;
if (/unsub|desuscr/.test(evento)) estado = 'Desuscrito';
else if (/list/.test(evento)) estado = LISTAS[listas.find((l) => LISTAS[l])] || null;
if (!correo || !estado) return [];
return [{ json: { correo, estado, evento, url: `https://wiptool.kommo.com/api/v4/contacts?query=${encodeURIComponent(correo)}&with=leads&limit=10` } }];

// == Armar cambios en Kommo (Code, una vez para todos los elementos)
const CAMPO_SECUENCIA = __CAMPO_SECUENCIA__;
const ENUMS = { 'Info solicitada': __ENUM_INFO__, 'Nutrición': __ENUM_NUTRICION__, Desuscrito: __ENUM_DESUSCRITO__ };
const ENUM_OPT_DESUSCRITO = __ENUM_OPT_DESUSCRITO__; // contacto: "Suscripción de marketing" = Desuscrito
const ev = $('Evento de Brevo').first().json;
// Kommo responde application/hal+json (llega como texto en data) y sin cuerpo (204) si no encuentra nada.
const r = $input.first().json;
const datos = typeof r.data === 'string' ? (() => { try { return JSON.parse(r.data); } catch (e) { return {}; } })() : r;
const contactos = ((datos._embedded && datos._embedded.contacts) || []).filter((c) => (c.custom_fields_values || [])
  .some((f) => f.field_code === 'EMAIL' && (f.values || []).some((v) => String(v.value).trim().toLowerCase() === ev.correo)));
const leads = contactos.flatMap((c) => ((c._embedded && c._embedded.leads) || []).map((l) => Number(l.id)));
if (!leads.length) return [];
const lead_id = Math.max(...leads);
const contacto = contactos.find((c) => ((c._embedded && c._embedded.leads) || []).some((l) => Number(l.id) === lead_id));
return [{ json: {
  lead: [{ id: lead_id, custom_fields_values: [{ field_id: CAMPO_SECUENCIA, values: [{ enum_id: ENUMS[ev.estado] }] }] }],
  contacto: ev.estado === 'Desuscrito' ? [{ id: contacto.id, custom_fields_values: [{ field_code: 'opt_status', values: [{ enum_id: ENUM_OPT_DESUSCRITO }] }] }] : [],
  nota: [{ entity_id: lead_id, note_type: 'common', params: { text: ev.estado === 'Desuscrito'
    ? `${ev.correo} se dio de baja de los correos de WIP en Brevo. Secuencia Brevo: Desuscrito.`
    : `${ev.correo} entró a la secuencia "${ev.estado}" de Brevo.` } }],
} }];
