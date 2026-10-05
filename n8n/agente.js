// n8n · F7 · agente de WhatsApp con Claude. armar-flujo.cjs toma cada parte por su marca "// ==" y reemplaza
// __CAMPO_RESPUESTA__ (campo de oportunidad "Respuesta del agente"), __BOT_RESPUESTA__ (Salesbot que envía ese campo
// por WhatsApp) e __INSTRUCCIONES__ (agente-instrucciones.md).
// Flujo: Kommo avisa cada mensaje entrante → se guarda → se esperan unos segundos (la gente escribe en varios mensajes) →
// si sigue siendo el último mensaje y la oportunidad es un prospecto (Leads entrantes o Nuevo, sin etiqueta "Atender persona"
// ni "Agente pausado"), Claude responde con el historial → la respuesta va al campo y el Salesbot la envía por WhatsApp.
// Si Claude decide pasar a una persona: etiqueta "Atender persona", tarea para el responsable, nota y correo a comercial@.

// == Mensaje entrante (Code, una vez para todos los elementos)
// Kommo manda el webhook como formulario: message[add][0][text], [element_id] (oportunidad), [talk_id], [id], [created_at], [attachment][type].
const b = $input.first().json.body || {};
// n8n puede entregar el formulario anidado (message.add[0].text) o con las claves planas ("message[add][0][text]").
const m =(b.message && b.message.add && b.message.add[0]) || {
  text: b['message[add][0][text]'], element_id: b['message[add][0][element_id]'], element_type: b['message[add][0][element_type]'],
  entity_id: b['message[add][0][entity_id]'], entity_type: b['message[add][0][entity_type]'], talk_id: b['message[add][0][talk_id]'],
  id: b['message[add][0][id]'], created_at: b['message[add][0][created_at]'], type: b['message[add][0][type]'],
  attachment: { type: b['message[add][0][attachment][type]'] },
};
if (m.type && m.type !== 'incoming') return [];
// La oportunidad: element_id cuando element_type es 2 (lead); si no, entity_id cuando entity_type es "lead".
const lead = Number(String(m.element_type) === '2' ? m.element_id : (String(m.entity_type) === 'lead' ? m.entity_id : m.element_id));
if (!lead) return [];
const adjunto = m.attachment && m.attachment.type ? `[La persona envió un ${m.attachment.type === 'voice' ? 'audio' : 'archivo (' + m.attachment.type + ')'}]` : '';
const texto = String(m.text || '').trim() || adjunto;
if (!texto) return [];
return [{ json: { lead_id: lead, mensaje_id: String(m.id || `${lead}-${m.created_at || Date.now()}`), talk_id: String(m.talk_id || ''), texto,
  momento: m.created_at ? new Date(Number(m.created_at) * 1000).toISOString() : new Date().toISOString() } }];

// == Decidir y preguntar a Claude (Code, una vez para todos los elementos)
// Revisa que este siga siendo el último mensaje del cliente y que la oportunidad sea un prospecto; arma el pedido a Claude.
const MODELO = 'claude-sonnet-5-5';
const ETAPAS_AGENTE = new Set([112413247, 112413251]); // Leads entrantes y Nuevo
const ORIGEN_UTM = { 'Meta Ads': 'meta_ads', Instagram: 'instagram', Facebook: 'facebook', Explee: 'explee', 'Correo (Brevo)': 'brevo',
  'Sitio web': 'sitio_web', 'Google Ads': 'google', LinkedIn: 'linkedin', Referido: 'referido', 'App sin app': 'app_sin_app' };
const yo = $('Mensaje entrante').first().json;
const historial = $('Historial').all().map((i) => i.json).filter((h) => h.rol).reverse(); // llega del más nuevo al más viejo
const leadR = $input.first().json;
const lead = typeof leadR.data === 'string' ? JSON.parse(leadR.data) : leadR;
const ultimoCliente = historial.filter((h) => h.rol === 'cliente').pop();
if (ultimoCliente && ultimoCliente.mensaje_id !== yo.mensaje_id) return []; // llegó otro mensaje después: responde esa ejecución
if (!ETAPAS_AGENTE.has(Number(lead.status_id))) return [];
const etiquetas = ((lead._embedded && lead._embedded.tags) || []).map((t) => t.name);
if (etiquetas.includes('Atender persona') || etiquetas.includes('Agente pausado')) return [];
const campo = (n) => { const f = (lead.custom_fields_values || []).find((x) => x.field_name === n); return f && f.values[0] ? String(f.values[0].value) : ''; };
const origen = campo('Origen');
const agenda = `https://calendly.com/comercial-wiptool/acercamiento-wip?utm_source=${ORIGEN_UTM[origen] || 'whatsapp'}&utm_medium=agente_whatsapp&utm_content=kommo-${lead.id}`;
// Historial en formato de Claude: cliente → user, agente → assistant; mensajes seguidos del mismo rol se juntan.
const mensajes = [];
for (const h of historial.slice(-30)) {
  const role = h.rol === 'agente' ? 'assistant' : 'user';
  const ult = mensajes[mensajes.length - 1];
  if (ult && ult.role === role) ult.content += '\n' + h.texto; else mensajes.push({ role, content: h.texto });
}
if (!mensajes.length || mensajes[0].role !== 'user') mensajes.unshift({ role: 'user', content: '(inicio de la conversación)' });
if (mensajes[mensajes.length - 1].role !== 'user') return [];
const hoy = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' }).format(new Date());
const sistema = `__INSTRUCCIONES__

# Contexto de esta conversación
- Fecha y hora en Colombia: ${hoy}
- La persona llegó por: ${origen || 'origen desconocido'}
- Enlace para agendar la reunión (úsalo tal cual): ${agenda}`;
const herramienta = {
  name: 'responder',
  description: 'Devuelve el próximo mensaje de WhatsApp para la persona y lo que aprendiste de ella.',
  input_schema: {
    type: 'object',
    properties: {
      respuesta: { type: 'string', description: 'El mensaje de WhatsApp, corto y sin markdown.' },
      pasar_a_persona: { type: 'boolean', description: 'true si un asesor debe continuar la conversación.' },
      motivo_traspaso: { type: 'string', description: 'Si pasar_a_persona es true: resumen breve de la conversación y por qué.' },
      datos: {
        type: 'object', description: 'Lo que la persona dijo de su operación (vacío si no lo dijo).',
        properties: { empresa: { type: 'string' }, pais: { type: 'string' }, tipo_operacion: { type: 'string' },
          servicios_mes: { type: 'string' }, correo: { type: 'string' }, quiere_reunion: { type: 'boolean' } },
      },
    },
    required: ['respuesta', 'pasar_a_persona'],
  },
};
return [{ json: { lead_id: lead.id, responsable: lead.responsible_user_id, nombre_lead: lead.name, origen,
  pedido: { model: MODELO, max_tokens: 1024, system: sistema, messages: mensajes, tools: [herramienta], tool_choice: { type: 'tool', name: 'responder' } } } }];

// == Respuesta de Claude (Code, una vez para todos los elementos)
// Saca la respuesta y arma lo que se escribe en Kommo y en Supabase.
const CAMPO_RESPUESTA = __CAMPO_RESPUESTA__;
const BOT_RESPUESTA = __BOT_RESPUESTA__;
const ctx = $('Decidir y preguntar a Claude').first().json;
const r = $input.first().json;
const uso = (r.content || []).find((c) => c.type === 'tool_use');
if (!uso || !uso.input || !uso.input.respuesta) throw new Error('Claude no devolvió una respuesta: ' + JSON.stringify(r).slice(0, 300));
const x = uso.input;
const texto = String(x.respuesta).replace(/\*\*?|__|^#+\s*/gm, '').trim().slice(0, 1500);
const traspaso = x.pasar_a_persona === true;
const d = x.datos || {};
const datos = [d.empresa && `Empresa: ${d.empresa}`, d.pais && `País: ${d.pais}`, d.tipo_operacion && `Operación: ${d.tipo_operacion}`,
  d.servicios_mes && `Servicios al mes: ${d.servicios_mes}`, d.correo && `Correo: ${d.correo}`].filter(Boolean).join('\n');
return [{ json: {
  lead_id: ctx.lead_id, texto, traspaso, responsable: ctx.responsable,
  kommo: [{ id: ctx.lead_id, custom_fields_values: [{ field_id: CAMPO_RESPUESTA, values: [{ value: texto }] }],
    ...(traspaso ? { tags_to_add: [{ name: 'Atender persona' }] } : {}) }],
  bot: [{ bot_id: BOT_RESPUESTA, entity_id: ctx.lead_id, entity_type: 2 }],
  guardar: { lead_id: ctx.lead_id, rol: 'agente', texto, momento: new Date().toISOString() },
  tarea: [{ entity_id: ctx.lead_id, entity_type: 'leads', responsible_user_id: ctx.responsable, task_type_id: 1,
    text: `Atender por WhatsApp: ${x.motivo_traspaso || 'el agente pasó la conversación'}`.slice(0, 500),
    complete_till: Math.floor(Date.now() / 1000) + 3600 }],
  nota: [{ entity_id: ctx.lead_id, note_type: 'common', params: { text: `El agente de WhatsApp pasó la conversación a una persona.\nMotivo: ${x.motivo_traspaso || '—'}${datos ? '\n' + datos : ''}` } }],
  correo: { sender: { name: 'Agente WIP', email: 'comercial@wiptool.com' }, to: [{ email: 'comercial@wiptool.com' }],
    subject: `Atender por WhatsApp: ${ctx.nombre_lead || 'oportunidad ' + ctx.lead_id}`,
    htmlContent: `<p>El agente de WhatsApp pasó esta conversación a una persona.</p><p><b>Motivo:</b> ${String(x.motivo_traspaso || '—').replace(/</g, '&lt;')}</p>${datos ? '<p>' + datos.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</p>' : ''}<p><a href="https://wiptool.kommo.com/leads/detail/${ctx.lead_id}">Abrir en Kommo</a></p>` },
} }];
