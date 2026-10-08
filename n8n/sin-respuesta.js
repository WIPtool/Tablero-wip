// n8n · F12 · pasa a "Sin respuesta (retomar)" las oportunidades de "En conversación" que dejaron de responder.
// armar-flujo.cjs toma cada parte por su marca "// ==".
// Regla: la persona no escribe hace 3 días o más, nadie le ha escrito en las últimas 24 h y ya se le hizo el último intento
// (un mensaje enviado más de 1 día después de su último mensaje, que suele ser la plantilla "Retomar contacto" de Meli),
// o ya pasaron 5 días. Si vuelve a escribir, F16 la regresa a "En conversación".

// == Trabajos sin respuesta (Code, una vez para todos los elementos)
// De 8 a. m. a 8 p. m. (hora Colombia), una vez por hora.
const EMBUDO = 14551307, EN_CONVERSACION = 112413251;
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
if (hora < 8 || hora >= 20) return [];
return [{ json: { url: `https://wiptool.kommo.com/api/v4/leads?limit=250&with=contacts&filter[statuses][0][pipeline_id]=${EMBUDO}&filter[statuses][0][status_id]=${EN_CONVERSACION}` } }];

// == Pedidos mensajes sin respuesta (Code, una vez para todos los elementos)
// Los mensajes de WhatsApp de esos contactos en los últimos 10 días (Kommo filtra los eventos de chat por contacto).
const r = $input.first().json;
const datos = typeof r.data === 'string' ? (() => { try { return JSON.parse(r.data); } catch (e) { return {}; } })() : r;
const leads = (datos._embedded && datos._embedded.leads) || [];
const contactos = [...new Set(leads.map((l) => ((l._embedded && l._embedded.contacts) || [])[0]).filter(Boolean).map((c) => c.id))];
if (!leads.length) return [];
// Kommo rechaza (400) la consulta con muchos contactos a la vez: se piden de a 10, hasta 3 páginas por grupo y tipo.
const desde = Math.floor(Date.now() / 1000) - 10 * 86400;
const pedidos = [];
for (let i = 0; i < contactos.length; i += 10) {
  const filtro = contactos.slice(i, i + 10).map((id) => `filter[entity_id][]=${id}`).join('&');
  for (const tipo of ['incoming_chat_message', 'outgoing_chat_message']) {
    for (let p = 1; p <= 3; p++) {
      pedidos.push({ json: { url: `https://wiptool.kommo.com/api/v4/events?limit=100&page=${p}&filter[entity]=contact&${filtro}&filter[type][]=${tipo}&filter[created_at][from]=${desde}` } });
    }
  }
}
return pedidos;

// == Armar sin respuesta (Code, una vez para todos los elementos)
const EMBUDO = 14551307, SIN_RESPUESTA = 112730823, DIA = 86400;
const leer = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const leads = (leer($('Leads en conversación').first().json)._embedded || {}).leads || [];
const eventos = $input.all().map((i) => leer(i.json)).flatMap((d) => (d._embedded && d._embedded.events) || []);
// Si Kommo no devolvió ningún mensaje (falló la consulta), no se mueve nada: sin mensajes todo parecería callado.
if (!eventos.length) return [];
const ahora = Math.floor(Date.now() / 1000);
const mover = [];
const notas = [];
for (const l of leads) {
  const contacto = ((l._embedded && l._embedded.contacts) || [])[0];
  // Se piden por contacto, pero Kommo los devuelve con la oportunidad (entity_type "lead") o con el contacto.
  const suyos = eventos.filter((e) => (e.entity_type === 'lead' && Number(e.entity_id) === Number(l.id))
    || (contacto && e.entity_type === 'contact' && Number(e.entity_id) === Number(contacto.id)));
  const entrantes = suyos.filter((e) => e.type === 'incoming_chat_message').map((e) => e.created_at);
  const salientes = suyos.filter((e) => e.type === 'outgoing_chat_message').map((e) => e.created_at);
  const ultEntrada = entrantes.length ? Math.max(...entrantes) : l.created_at;
  const ultSalida = salientes.length ? Math.max(...salientes) : 0;
  const callado = ahora - ultEntrada >= 3 * DIA;
  const sinNadaReciente = ahora - ultSalida >= DIA;
  const ultimoIntento = ultSalida - ultEntrada >= DIA || ahora - ultEntrada >= 5 * DIA;
  if (!(callado && sinNadaReciente && ultimoIntento)) continue;
  const dias = Math.floor((ahora - ultEntrada) / DIA);
  mover.push({ id: l.id, pipeline_id: EMBUDO, status_id: SIN_RESPUESTA });
  notas.push({ entity_id: l.id, note_type: 'common', params: { text: `Pasó a "Sin respuesta (retomar)": no responde hace ${dias} días. Si vuelve a escribir, regresa sola a "En conversación".` } });
}
if (!mover.length) return [];
return [{ json: { mover, notas } }];
