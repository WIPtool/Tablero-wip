// n8n · F7 · agente de WhatsApp con Claude. armar-flujo.cjs toma cada parte por su marca "// ==" y reemplaza
// __CAMPO_RESPUESTA__ (campo de oportunidad "Respuesta del agente"), __BOT_RESPUESTA__ (Salesbot que envía ese campo
// por WhatsApp), __INSTRUCCIONES__ (agente-instrucciones.md), __MODO_PRUEBA__ (true: solo etiqueta "Prueba agente")
// y __COMUN__ (la parte "Común del agente", que comparten la respuesta y el seguimiento).
// Flujo F16: Kommo avisa cada mensaje entrante → se guarda → se esperan unos segundos (la gente escribe en varios mensajes) →
// si sigue siendo el último mensaje y la oportunidad es un prospecto (Leads entrantes o Nuevo, sin etiqueta "Atender persona"
// ni "Agente pausado") y nadie del equipo le escribió en las últimas 24 h, Claude responde con el historial → la respuesta
// va al campo y el Salesbot la envía por WhatsApp.
// Si Claude decide pasar a una persona: etiqueta "Atender persona", tarea para el responsable, nota y correo a comercial@.
// Seguimiento (rama de F12, cada hora): a quien dejó de responder hace 3 horas le escribe una vez más, dentro de la ventana
// de 24 horas de WhatsApp.

// == Común del agente (se pega al inicio de los nodos que lo usan)
const ETAPAS_AGENTE = new Set([112413247, 112413251]); // Leads entrantes y Nuevo
const ORIGEN_UTM = { 'Meta Ads': 'meta_ads', Instagram: 'instagram', Facebook: 'facebook', Explee: 'explee', 'Correo (Brevo)': 'brevo',
  'Sitio web': 'sitio_web', 'Google Ads': 'google', LinkedIn: 'linkedin', Referido: 'referido', 'App sin app': 'app_sin_app' };
// Kommo responde application/hal+json y el nodo HTTP lo deja como texto en data; las páginas vacías llegan sin cuerpo (204).
const leerKommo = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const etiquetasDe = (lead) => ((lead._embedded && lead._embedded.tags) || []).map((t) => t.name);
// Mensajes que salieron por WhatsApp (eventos outgoing_chat_message de Kommo) contra respuestas del agente en las últimas 24 h:
// si salieron más, alguien del equipo escribió (desde Kommo o desde la app de WhatsApp Business del celular) y el agente no se mete.
const personaEscribio = (enviados, historial) => {
  const desde = Date.now() - 24 * 3600 * 1000;
  const delAgente = historial.filter((h) => h.rol === 'agente' && h.tipo !== 'sin_seguimiento' && new Date(h.momento).getTime() > desde).length;
  return enviados > delAgente;
};
// Contexto de la conversación para Claude: origen, anuncio que vio, enlaces medidos por plataforma y agenda.
const contextoAgente = (lead, anuncio) => {
  const campo = (n) => { const f = (lead.custom_fields_values || []).find((x) => x.field_name === n); return f && f.values[0] ? String(f.values[0].value) : ''; };
  const utm = (code) => { const f = (lead.custom_fields_values || []).find((x) => x.field_code === code); return f && f.values[0] ? String(f.values[0].value) : ''; };
  // Si el campo Origen está vacío pero el chat trae utm_source=meta_ads (parámetros de los anuncios), es Meta Ads.
  const origen = campo('Origen') || (utm('UTM_SOURCE') === 'meta_ads' ? 'Meta Ads' : '');
  // Anuncio que vio la persona (texto desde meta_anuncio) y plataforma, si Meta la reemplazó en utm_term.
  const plataforma = { fb: 'Facebook', facebook: 'Facebook', ig: 'Instagram', instagram: 'Instagram', msg: 'Messenger', an: 'Audience Network' }[utm('UTM_TERM').toLowerCase()] || '';
  const lineaAnuncio = utm('UTM_CONTENT')
    ? `- Llegó por un anuncio de Meta${plataforma ? ' en ' + plataforma : ''}${anuncio ? '. Texto del anuncio: «' + anuncio.texto + '»' : ' (no tengo el texto del anuncio)'}. Úsalo para entender qué le interesó; no menciones nombres internos de campañas ni de anuncios.`
    : '';
  const campanaKommo = campo('Campaña');
  // Enlaces al sitio medidos con la plataforma de donde viene la persona (accionadores; redirects en vercel.json de landing-wip).
  const W = 'https://www.wiptool.com';
  const ENLACES = {
    Instagram: { portada: W + '/ig', equipos: W + '/equipos/ig', planes: W + '/planes/ig' },
    Facebook: { portada: W + '/fb', equipos: W + '/equipos/fb', planes: W + '/planes/fb' },
    'Meta Ads': { portada: W + '/meta', equipos: W + '/equipos/meta', planes: W + '/planes/meta' },
    Explee: { portada: W + '/explee', equipos: W + '/equipos/explee', planes: W + '/planes/explee' },
    'Correo (Brevo)': { portada: W + '/email', equipos: W + '/equipos/email', planes: W + '/planes/email' },
  };
  const enlaces = ENLACES[origen] || { portada: W, equipos: W + '/equipos', planes: W + '/equipos#planes' };
  // Agenda medida por plataforma (registra el clic en Analytics y pasa a Calendly con UTM); c=kommo-<id> hace que la cita mueva esta oportunidad.
  const AGENDA = { Instagram: '/agenda-ig', Facebook: '/agenda-fb', 'Meta Ads': '/agenda-meta', Explee: '/agenda-explee', 'Correo (Brevo)': '/agenda-email' };
  const agenda = `https://calendly.com/comercial-wiptool/acercamiento-wip?utm_source=${ORIGEN_UTM[origen] || 'whatsapp'}&utm_medium=chat&utm_content=kommo-${lead.id}`;
  const agendaMedida = AGENDA[origen] ? `${W}${AGENDA[origen]}?c=kommo-${lead.id}` : agenda;
  const hoy = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' }).format(new Date());
  const texto = `# Contexto de esta conversación
- Fecha y hora en Colombia: ${hoy}
- La persona llegó por: ${origen || 'origen desconocido'}${campanaKommo && !utm('UTM_CONTENT') ? ' (campaña: ' + campanaKommo + ')' : ''}
${lineaAnuncio ? lineaAnuncio + '\n' : ''}- Enlace para agendar la reunión (úsalo tal cual): ${agendaMedida}
- Enlaces al sitio para esta persona (úsalos tal cual): portada y WIP Redes ${enlaces.portada} · WIP Equipos ${enlaces.equipos} · planes de WIP Equipos ${enlaces.planes}`;
  return { origen, texto };
};
// Historial en formato de Claude: cliente → user, agente → assistant; mensajes seguidos del mismo rol se juntan.
const mensajesClaude = (historial) => {
  const mensajes = [];
  for (const h of historial.slice(-30)) {
    const role = h.rol === 'agente' ? 'assistant' : 'user';
    const ult = mensajes[mensajes.length - 1];
    // Los avisos del error 131060 guardados antes de reconocerlos se muestran igual que los nuevos.
    const texto = /No se puede mostrar este mensaje en el CRM|Unable to display this message in CRM/i.test(h.texto) ? '[Mensaje ilegible: WhatsApp no deja ver en el CRM lo que escribió la persona]' : h.texto;
    if (ult && ult.role === role) ult.content += '\n' + texto; else mensajes.push({ role, content: texto });
  }
  if (!mensajes.length || mensajes[0].role !== 'user') mensajes.unshift({ role: 'user', content: '(inicio de la conversación)' });
  return mensajes;
};
// Kommo borra los emojis de 4 bytes (👋 📅 🙌…) al guardar el campo que envía el Salesbot: se cambian por equivalentes que sí
// pasan (✋ ⏰ ✨ ✅ ➡️ ⚡ ☎️ ☺️) y los demás se quitan, para que no queden espacios dobles.
const EMOJIS = { '👋': '✋', '🙋': '✋', '📅': '⏰', '🗓️': '⏰', '🗓': '⏰', '📆': '⏰', '🙌': '✨', '😊': '☺️', '🙂': '☺️', '😃': '☺️', '💪': '✨',
  '👍': '✅', '👌': '✅', '👉': '➡️', '📍': '➡️', '🚀': '⚡', '🔥': '⚡', '📞': '☎️', '💬': '✨', '📊': '✅', '🚚': '⚡' };
const limpiarTexto = (t) => Object.entries(EMOJIS).reduce((s, [a, b]) => s.split(a).join(b), String(t || ''))
  .replace(/\*\*?|__|^#+\s*/gm, '').replace(/[\u{10000}-\u{10FFFF}]️?/gu, '').replace(/[ \t]{2,}/g, ' ').replace(/ ([.,!?])/g, '$1')
  .trim().slice(0, 1500);

// == Mensaje entrante (Code, una vez para todos los elementos)
// Kommo manda el webhook como formulario: message[add][0][text], [element_id] (oportunidad), [talk_id], [id], [created_at], [attachment][type].
const b = $input.first().json.body || {};
// n8n puede entregar el formulario anidado (message.add[0].text) o con las claves planas ("message[add][0][text]").
const m =(b.message && b.message.add && b.message.add[0]) || {
  text: b['message[add][0][text]'], element_id: b['message[add][0][element_id]'], element_type: b['message[add][0][element_type]'],
  entity_id: b['message[add][0][entity_id]'], entity_type: b['message[add][0][entity_type]'], talk_id: b['message[add][0][talk_id]'],
  id: b['message[add][0][id]'], created_at: b['message[add][0][created_at]'], type: b['message[add][0][type]'], // incoming / outgoing (message_type es el contenido: text, picture…)
  attachment: { type: b['message[add][0][attachment][type]'] },
};
if (m.type && m.type !== 'incoming') return [];
// La oportunidad: element_id cuando element_type es 2 (lead); si no, entity_id cuando entity_type es "lead".
const lead = Number(String(m.element_type) === '2' ? m.element_id : (String(m.entity_type) === 'lead' ? m.entity_id : m.element_id));
if (!lead) return [];
const adjunto = m.attachment && m.attachment.type ? `[La persona envió un ${m.attachment.type === 'voice' ? 'audio' : 'archivo (' + m.attachment.type + ')'}]` : '';
// Con WhatsApp en coexistencia, algunos mensajes (sobre todo el primero que llega desde un anuncio) solo se ven en la app del
// celular y Kommo manda un aviso del error 131060 en vez del texto: se reemplaza por una marca para que el agente salude.
const ILEGIBLE = /No se puede mostrar este mensaje en el CRM|Unable to display this message in CRM|error-131060|131060/i;
const crudo = String(m.text || '').trim();
const texto = ILEGIBLE.test(crudo) ? '[Mensaje ilegible: WhatsApp no deja ver en el CRM lo que escribió la persona]' : (crudo || adjunto);
if (!texto) return [];
return [{ json: { lead_id: lead, mensaje_id: String(m.id || `${lead}-${m.created_at || Date.now()}`), talk_id: String(m.talk_id || ''), texto,
  momento: m.created_at ? new Date(Number(m.created_at) * 1000).toISOString() : new Date().toISOString() } }];

// == Pide reprogramar (Code, una vez para todos los elementos)
// Botón "Necesito reprogramar" del recordatorio de la demo (F19): tarea urgente para el responsable de la oportunidad, nota y
// correo a comercial@ (la demo empieza en minutos). Va aparte del agente, así que funciona en cualquier etapa.
const msg = $('Mensaje entrante').first().json;
if (!/^\s*necesito reprogramar\s*[.!]?\s*$/i.test(msg.texto)) return [];
const lead = leerKommo($input.first().json);
const nombre = lead.name || 'oportunidad ' + msg.lead_id;
return [{ json: {
  tarea: [{ entity_id: msg.lead_id, entity_type: 'leads', responsible_user_id: lead.responsible_user_id, task_type_id: 1,
    text: 'Reprogramar la demo: la persona tocó "Necesito reprogramar" en el recordatorio de WhatsApp. Escríbele para acordar un nuevo horario.',
    complete_till: Math.floor(Date.now() / 1000) + 15 * 60 }],
  nota: [{ entity_id: msg.lead_id, note_type: 'common', params: { text: 'Pidió reprogramar la demo desde el recordatorio de WhatsApp (botón "Necesito reprogramar").' } }],
  correo: { sender: { name: 'Agente WIP', email: 'comercial@wiptool.com' }, to: [{ email: 'comercial@wiptool.com' }],
    subject: `Reprogramar demo: ${nombre}`,
    htmlContent: `<p>${String(nombre).replace(/</g, '&lt;')} tocó <b>Necesito reprogramar</b> en el recordatorio de la demo por WhatsApp.</p><p>Escríbele para acordar un nuevo horario.</p><p><a href="https://wiptool.kommo.com/leads/detail/${msg.lead_id}">Abrir en Kommo</a></p>` },
} }];

// == Mover a En conversación (Code, una vez para todos los elementos)
// Kommo solo saca un chat de "Leads entrantes" cuando alguien lo acepta o edita la oportunidad en Kommo: si se le contesta desde
// la app de WhatsApp del celular, se queda ahí. Cada mensaje que entra pasa la oportunidad a "En conversación"; lo mismo si
// estaba en "Sin respuesta (retomar)" y volvió a escribir (y entonces Meli le responde).
const EMBUDO = 14551307, ENTRANTES = 112413247, EN_CONVERSACION = 112413251, SIN_RESPUESTA = 112730823;
const j = $input.first().json;
const lead = typeof j.data === 'string' ? JSON.parse(j.data) : j;
if (Number(lead.pipeline_id) !== EMBUDO || ![ENTRANTES, SIN_RESPUESTA].includes(Number(lead.status_id))) return [];
return [{ json: { cambio: [{ id: lead.id, pipeline_id: EMBUDO, status_id: EN_CONVERSACION }] } }];

// == Anuncio a buscar (Code, una vez para todos los elementos)
// Si la oportunidad llegó por un anuncio de Meta (utm_campaign y utm_content), pide su texto a Supabase (tabla meta_anuncio).
// También arma la consulta de los mensajes que salieron por WhatsApp a ese contacto en las últimas 24 h (para saber si escribió alguien del equipo).
const SUPABASE = '__SUPABASE__';
const leadR = $input.first().json;
const lead = typeof leadR.data === 'string' ? JSON.parse(leadR.data) : leadR;
const utm = (code) => { const f = (lead.custom_fields_values || []).find((x) => x.field_code === code); return f && f.values[0] ? String(f.values[0].value) : ''; };
const campana = utm('UTM_CAMPAIGN'), anuncio = utm('UTM_CONTENT');
const url = campana && anuncio
  ? `${SUPABASE}/rest/v1/meta_anuncio?select=nombre,campana,texto&campana=eq.${encodeURIComponent(campana)}&nombre=eq.${encodeURIComponent(anuncio)}&limit=1`
  : `${SUPABASE}/rest/v1/meta_anuncio?select=nombre&anuncio_id=eq.ninguno`;
// Los eventos de chat de Kommo solo se filtran por contacto (por oportunidad no los devuelve).
const contacto = ((lead._embedded && lead._embedded.contacts) || [])[0];
const url_enviados = `https://wiptool.kommo.com/api/v4/events?filter[entity][]=contact&filter[entity_id][]=${contacto ? contacto.id : 0}`
  + `&filter[type][]=outgoing_chat_message&filter[created_at][from]=${Math.floor(Date.now() / 1000) - 86400}&limit=100`;
return [{ json: { url, url_enviados, con_contacto: !!contacto } }];

// == Decidir y preguntar a Claude (Code, una vez para todos los elementos)
// Revisa que este siga siendo el último mensaje del cliente y que la oportunidad sea un prospecto; arma el pedido a Claude.
__COMUN__
const MODELO = 'claude-sonnet-5-5';
const yo = $('Mensaje entrante').first().json;
const historial = $('Historial').all().map((i) => i.json).filter((h) => h.rol).reverse(); // llega del más nuevo al más viejo
const lead = leerKommo($('Lead en Kommo').first().json);
const ultimoCliente = historial.filter((h) => h.rol === 'cliente').pop();
if (ultimoCliente && ultimoCliente.mensaje_id !== yo.mensaje_id) return []; // llegó otro mensaje después: responde esa ejecución
// Si estaba en "Sin respuesta (retomar)" y volvió a escribir, "Mover a En conversación" ya la está pasando a En conversación.
if (!ETAPAS_AGENTE.has(Number(lead.status_id)) && Number(lead.status_id) !== 112730823) return [];
const etiquetas = etiquetasDe(lead);
if (etiquetas.includes('Atender persona') || etiquetas.includes('Agente pausado')) return [];
// Modo prueba: mientras esté activo, solo responde a oportunidades con la etiqueta "Prueba agente".
const MODO_PRUEBA = __MODO_PRUEBA__;
if (MODO_PRUEBA && !etiquetas.includes('Prueba agente')) return [];
// Si alguien del equipo le escribió en las últimas 24 h (desde Kommo o desde el celular), la conversación es de esa persona.
const enviados = ($('Mensajes enviados').all().map((i) => leerKommo(i.json)).find((x) => x._embedded) || { _embedded: { events: [] } })._embedded.events || [];
if ($('Anuncio a buscar').first().json.con_contacto && personaEscribio(enviados.length, historial)) return [];
const anuncio = $('Anuncio de Meta').all().map((i) => i.json).find((a) => a.texto) || null;
const ctx = contextoAgente(lead, anuncio);
const mensajes = mensajesClaude(historial);
if (mensajes[mensajes.length - 1].role !== 'user') return [];
const sistema = `__INSTRUCCIONES__

${ctx.texto}

# Formato de salida
Responde SIEMPRE llamando la herramienta responder, una sola vez, con el mensaje de WhatsApp en respuesta. No escribas texto fuera de la herramienta.`;
const herramienta = {
  name: 'responder',
  description: 'Devuelve el próximo mensaje de WhatsApp para la persona y lo que aprendiste de ella.',
  input_schema: {
    type: 'object',
    properties: {
      respuesta: { type: 'string', description: 'El mensaje de WhatsApp según el paso del guion: corto (hasta 35 palabras salvo el reto, la explicación de WIP y el cierre), con 1 emoji de la lista permitida, sin markdown; los saltos de línea se permiten.' },
      pasar_a_persona: { type: 'boolean', description: 'true si un asesor debe continuar la conversación.' },
      motivo_traspaso: { type: 'string', description: 'Si pasar_a_persona es true: resumen breve de la conversación y por qué.' },
      datos: {
        type: 'object', description: 'Lo que la persona dijo de su operación (vacío si no lo dijo).',
        properties: { nombre: { type: 'string' }, empresa: { type: 'string' }, pais: { type: 'string' }, tipo_operacion: { type: 'string' },
          equipo: { type: 'string', description: 'propio, red de terceros o ambos' }, herramienta_actual: { type: 'string' },
          reto: { type: 'string' },
          reto_correo: { type: 'string', description: 'El reto como frase corta en minúscula que complete "tu reto principal es ___", sin punto final. Ej.: "manejar todo por Excel y WhatsApp", "no tener visibilidad en tiempo real de tus servicios", "los errores y la pérdida de tiempo en las asignaciones".' },
          servicios_mes: { type: 'string' }, correo: { type: 'string', description: 'El correo que la persona escribió, tal cual.' }, quiere_reunion: { type: 'boolean' } },
      },
    },
    required: ['respuesta', 'pasar_a_persona'],
  },
};
return [{ json: { lead_id: lead.id, responsable: lead.responsible_user_id, nombre_lead: lead.name, origen: ctx.origen,
  pedido: { model: MODELO, max_tokens: 1024, system: sistema, messages: mensajes, tools: [herramienta], tool_choice: { type: 'auto' } } } }]; // este modelo no acepta forzar la herramienta: se pide en el system

// == Respuesta de Claude (Code, una vez para todos los elementos)
// Saca la respuesta y arma lo que se escribe en Kommo y en Supabase.
__COMUN__
const CAMPO_RESPUESTA = __CAMPO_RESPUESTA__;
const BOT_RESPUESTA = __BOT_RESPUESTA__;
const ctx = $('Decidir y preguntar a Claude').first().json;
const r = $input.first().json;
const uso = (r.content || []).find((c) => c.type === 'tool_use' && c.name === 'responder');
// Si Claude respondió con texto en vez de la herramienta, se usa ese texto como mensaje.
const textoLibre = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
const x = uso && uso.input && uso.input.respuesta ? uso.input : { respuesta: textoLibre, pasar_a_persona: false };
if (!x.respuesta) throw new Error('Claude no devolvió una respuesta: ' + JSON.stringify(r).slice(0, 300));
const texto = limpiarTexto(x.respuesta);
const traspaso = x.pasar_a_persona === true;
const d = x.datos || {};
const datos = [d.nombre && `Nombre: ${d.nombre}`, d.empresa && `Empresa: ${d.empresa}`, d.pais && `País: ${d.pais}`,
  d.tipo_operacion && `Operación: ${d.tipo_operacion}`, d.equipo && `Equipo: ${d.equipo}`, d.herramienta_actual && `Herramienta actual: ${d.herramienta_actual}`,
  d.reto && `Reto: ${d.reto}`, d.servicios_mes && `Servicios al mes: ${d.servicios_mes}`, d.correo && `Correo: ${d.correo}`].filter(Boolean).join('\n');
// Correo para Brevo: la primera vez que la persona da un correo válido entra a la lista "Info solicitada" (secuencia de correos)
// con su nombre, empresa y reto; en Kommo queda la secuencia, el reto, el correo en el contacto y una nota.
const LISTA_INFO = __LISTA_INFO__;
const CAMPO_SECUENCIA = __CAMPO_SECUENCIA__;
const ENUM_INFO = __ENUM_INFO__;
const CAMPO_RETO = __CAMPO_RETO__;
const lead = leerKommo($('Lead en Kommo').first().json);
const yaEnSecuencia = (lead.custom_fields_values || []).some((f) => f.field_id === CAMPO_SECUENCIA && (f.values || []).length);
const correoCliente = String(d.correo || '').trim().toLowerCase();
const contacto = ((lead._embedded && lead._embedded.contacts) || [])[0];
// RETO_PRINCIPAL va dentro de frases de los correos ("tu reto principal es ___"): sin punto final y con un valor por defecto.
const retoCorreo = String(d.reto_correo || '').trim().replace(/[.。]+$/, '') || 'tener el control de tus servicios en tiempo real';
const atributos = Object.fromEntries(Object.entries({ NOMBRE: d.nombre, NOMBRE_EMPRESA: d.empresa, RETO_PRINCIPAL: retoCorreo })
  .filter(([, v]) => v && String(v).trim()).map(([k, v]) => [k, String(v).trim()]));
const brevo = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correoCliente) && !yaEnSecuencia ? {
  contacto: { email: correoCliente, attributes: atributos, listIds: [LISTA_INFO], updateEnabled: true },
  lead: [{ id: ctx.lead_id, custom_fields_values: [{ field_id: CAMPO_SECUENCIA, values: [{ enum_id: ENUM_INFO }] },
    ...(d.reto ? [{ field_id: CAMPO_RETO, values: [{ value: String(d.reto).slice(0, 250) }] }] : [])] }],
  contacto_kommo: contacto ? [{ id: contacto.id, custom_fields_values: [{ field_code: 'EMAIL', values: [{ value: correoCliente, enum_code: 'WORK' }] }] }] : [],
  nota: [{ entity_id: ctx.lead_id, note_type: 'common', params: { text: `Meli consiguió el correo ${correoCliente} y la persona entró a la secuencia "Info solicitada" de Brevo.\nReto para los correos: ${retoCorreo}${datos ? '\n' + datos : ''}` } }],
} : null;
return [{ json: {
  brevo,
  lead_id: ctx.lead_id, texto, traspaso, responsable: ctx.responsable,
  kommo: [{ id: ctx.lead_id, custom_fields_values: [{ field_id: CAMPO_RESPUESTA, values: [{ value: texto }] }],
    ...(traspaso ? { tags_to_add: [{ name: 'Atender persona' }] } : {}) }],
  bot: [{ bot_id: BOT_RESPUESTA, entity_id: ctx.lead_id, entity_type: 2 }],
  guardar: { lead_id: ctx.lead_id, rol: 'agente', texto, traspaso, momento: new Date().toISOString() },
  tarea: [{ entity_id: ctx.lead_id, entity_type: 'leads', responsible_user_id: ctx.responsable, task_type_id: 1,
    text: `Atender por WhatsApp: ${x.motivo_traspaso || 'el agente pasó la conversación'}`.slice(0, 500),
    complete_till: Math.floor(Date.now() / 1000) + 3600 }],
  nota: [{ entity_id: ctx.lead_id, note_type: 'common', params: { text: `El agente de WhatsApp pasó la conversación a una persona.\nMotivo: ${x.motivo_traspaso || '—'}${datos ? '\n' + datos : ''}` } }],
  correo: { sender: { name: 'Agente WIP', email: 'comercial@wiptool.com' }, to: [{ email: 'comercial@wiptool.com' }],
    subject: `Atender por WhatsApp: ${ctx.nombre_lead || 'oportunidad ' + ctx.lead_id}`,
    htmlContent: `<p>El agente de WhatsApp pasó esta conversación a una persona.</p><p><b>Motivo:</b> ${String(x.motivo_traspaso || '—').replace(/</g, '&lt;')}</p>${datos ? '<p>' + datos.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</p>' : ''}<p><a href="https://wiptool.kommo.com/leads/detail/${ctx.lead_id}">Abrir en Kommo</a></p>` },
} }];

// == Trabajos seguimiento (Code, una vez para todos los elementos)
// Solo de 8 a. m. a 8 p. m. (hora Colombia), para no escribirle a nadie de madrugada. La vista de Supabase trae las
// conversaciones en silencio que siguen dentro de la ventana de 24 h de WhatsApp, con su historial.
const SUPABASE = '__SUPABASE__';
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
if (hora < 8 || hora >= 20) return [];
return [{ json: { url: `${SUPABASE}/rest/v1/agente_seguimiento_pendiente?select=lead_id,ult_cliente,ult_agente,historial` } }];

// == Pedidos Kommo seguimiento (Code, una vez para todos los elementos)
// Una consulta con todas las oportunidades pendientes y hasta 3 páginas de mensajes enviados en las últimas 24 h
// (los eventos de chat traen la oportunidad en entity_id).
const ids = $input.all().map((i) => i.json.lead_id).filter(Boolean);
if (!ids.length) return [];
const K = 'https://wiptool.kommo.com/api/v4';
const desde = Math.floor(Date.now() / 1000) - 86400;
return [
  { json: { url: `${K}/leads?${ids.map((id) => 'filter[id][]=' + id).join('&')}&limit=250` } },
  ...[1, 2, 3].map((p) => ({ json: { url: `${K}/events?filter[type][]=outgoing_chat_message&filter[created_at][from]=${desde}&limit=100&page=${p}` } })),
];

// == Armar seguimientos (Code, una vez para todos los elementos)
// Revisa cada conversación contra Kommo (etapa, etiquetas, si escribió alguien del equipo) y arma el pedido a Claude.
__COMUN__
const MODELO = 'claude-sonnet-5-5';
const pendientes = $('Pendientes de seguimiento').all().map((i) => i.json).filter((p) => p.lead_id);
const respuestas = $input.all().map((i) => leerKommo(i.json));
const leads = new Map(respuestas.flatMap((r) => (r._embedded && r._embedded.leads) || []).map((l) => [Number(l.id), l]));
const eventos = respuestas.flatMap((r) => (r._embedded && r._embedded.events) || []);
const salida = [];
for (const p of pendientes) {
  const lead = leads.get(Number(p.lead_id));
  if (!lead || !ETAPAS_AGENTE.has(Number(lead.status_id))) continue;
  const etiquetas = etiquetasDe(lead);
  if (etiquetas.includes('Atender persona') || etiquetas.includes('Agente pausado')) continue;
  const historial = (p.historial || []).filter((h) => h.rol);
  const enviados = eventos.filter((e) => Number(e.entity_id) === Number(p.lead_id)).length;
  if (personaEscribio(enviados, historial)) continue;
  const ctx = contextoAgente(lead, null);
  const horas = Math.round((Date.now() - new Date(p.ult_agente).getTime()) / 3600000);
  const mensajes = mensajesClaude(historial);
  mensajes.push({ role: 'user', content: `(Nota interna, no la escribió la persona: no ha respondido tu último mensaje hace ${horas} horas. Decide si conviene escribirle una vez más y, si conviene, escribe el mensaje de seguimiento.)` });
  const sistema = `__INSTRUCCIONES__

${ctx.texto}

# Tarea: mensaje de seguimiento
La persona dejó de responder. Escribe UN mensaje corto de seguimiento (máximo 20 palabras) que retome la conversación con naturalidad:
- NO repitas la pregunta de tu último mensaje: si no la respondió, cambia de ángulo. No vuelvas a saludar como si fuera la primera vez, no reclames que no ha respondido ni presiones.
- Aporta algo nuevo y útil según el punto del guion donde quedó: si no ha dado su correo ni agendado, pregúntale si quiere agendar la demo virtual (unos 45 minutos) o que le envíes la información detallada a su correo; si preguntó qué hace WIP o si se puede personalizar, un enlace al sitio que le sirva.
- Pon el enlace de agenda solo si la persona ya dijo que quiere la demo.
- Termina con una pregunta de sí o no, fácil de responder.
- 1 emoji de la lista permitida.
No escribas (enviar = false) si la persona cerró la conversación: dijo que no le interesa, que no la contacten, que ya agendó, que lo revisará y avisará, o se despidió.

# Formato de salida
Responde SIEMPRE llamando la herramienta seguimiento, una sola vez. No escribas texto fuera de la herramienta.`;
  const herramienta = {
    name: 'seguimiento',
    description: 'Decide si se le escribe a la persona y devuelve el mensaje de seguimiento.',
    input_schema: {
      type: 'object',
      properties: {
        enviar: { type: 'boolean', description: 'true si conviene escribirle; false si la persona cerró la conversación.' },
        mensaje: { type: 'string', description: 'El mensaje de WhatsApp (si enviar es true): máximo 20 palabras, una pregunta, 1 emoji permitido, sin markdown.' },
        motivo: { type: 'string', description: 'Por qué no conviene escribirle (si enviar es false).' },
      },
      required: ['enviar'],
    },
  };
  salida.push({ json: { lead_id: lead.id, pedido: { model: MODELO, max_tokens: 1500, system: sistema, messages: mensajes, tools: [herramienta], tool_choice: { type: 'auto' } } } });
}
return salida;

// == Seguimiento de Claude (Code, una vez por cada elemento)
// Saca el mensaje y arma lo que se escribe en Kommo y en Supabase. Si Claude decide no escribir, solo se guarda esa
// decisión (tipo sin_seguimiento) para no volver a preguntar en la próxima hora.
// Modo borrador (__SEGUIMIENTO_EN_VIVO__ = false): no envía nada; guarda el mensaje propuesto como sin_seguimiento "(borrador)" para revisarlo.
__COMUN__
const EN_VIVO = __SEGUIMIENTO_EN_VIVO__;
const CAMPO_RESPUESTA = __CAMPO_RESPUESTA__;
const BOT_RESPUESTA = __BOT_RESPUESTA__;
const lead_id = $('Armar seguimientos').item.json.lead_id;
const r = $json;
const uso = (r.content || []).find((c) => c.type === 'tool_use' && c.name === 'seguimiento');
const textoLibre = (r.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
const x = uso && uso.input ? uso.input : { enviar: !!textoLibre, mensaje: textoLibre };
const texto = limpiarTexto(x.mensaje);
const propuesto = x.enviar === true && !!texto;
const enviar = EN_VIVO && propuesto;
// Si Claude falló (error, se le acabaron los tokens o dijo enviar sin mensaje), no se guarda nada: se reintenta en la próxima hora.
const fallo = (!uso && !textoLibre) || (x.enviar === true && !texto);
return { json: {
  lead_id, enviar, fallo, stop: r.stop_reason || (r.error && r.error.type) || '',
  kommo: [{ id: lead_id, custom_fields_values: [{ field_id: CAMPO_RESPUESTA, values: [{ value: texto }] }] }],
  bot: [{ bot_id: BOT_RESPUESTA, entity_id: lead_id, entity_type: 2 }],
  guardar: enviar
    ? { lead_id, rol: 'agente', tipo: 'seguimiento', texto, momento: new Date().toISOString() }
    : { lead_id, rol: 'agente', tipo: 'sin_seguimiento', momento: new Date().toISOString(),
        texto: (propuesto ? `(borrador, no enviado) ${texto}` : `(sin seguimiento: ${x.motivo || 'Claude no devolvió mensaje'})`).slice(0, 1500) },
} };

// == Trabajos plantilla (Code, una vez para todos los elementos)
// Segundo seguimiento con la plantilla "Retomar contacto WIP" (Salesbot __BOT_PLANTILLA__): de lunes a viernes, de 9 a. m. a 6 p. m.
// La vista trae a quien recibió el primer seguimiento hace 2 a 5 días y no respondió.
const SUPABASE = '__SUPABASE__';
const ahora = new Date();
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(ahora));
const dia = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', weekday: 'short' }).format(ahora);
if (hora < 9 || hora >= 18 || dia === 'Sat' || dia === 'Sun') return [];
return [{ json: { url: `${SUPABASE}/rest/v1/agente_plantilla_pendiente?select=lead_id,ult_seguimiento` } }];

// == Pedidos Kommo plantilla (Code, una vez para todos los elementos)
// Las oportunidades pendientes y hasta 6 páginas de mensajes enviados en los últimos 5 días (para ver si escribió alguien del equipo).
const ids = $input.all().map((i) => i.json.lead_id).filter(Boolean);
if (!ids.length) return [];
const K = 'https://wiptool.kommo.com/api/v4';
const desde = Math.floor(Date.now() / 1000) - 5 * 86400;
return [
  { json: { url: `${K}/leads?${ids.map((id) => 'filter[id][]=' + id).join('&')}&limit=250` } },
  ...[1, 2, 3, 4, 5, 6].map((p) => ({ json: { url: `${K}/events?filter[type][]=outgoing_chat_message&filter[created_at][from]=${desde}&limit=100&page=${p}` } })),
];

// == Armar plantillas (Code, una vez para todos los elementos)
// Solo prospectos (Leads entrantes o Nuevo) sin "Atender persona"/"Agente pausado" y sin mensajes del equipo después del
// primer seguimiento (cualquier mensaje enviado más de 2 minutos después de ese seguimiento lo escribió una persona).
__COMUN__
const BOT_PLANTILLA = __BOT_PLANTILLA__;
const TEXTO = 'Hola ✋ Te escribimos de WIP por tu consulta sobre la gestión de servicios en campo. ¿Te gustaría verlo en una reunión corta con un asesor? Responde Sí y te enviamos los horarios. [Plantilla de WhatsApp con botón "Sí, me interesa"]';
const pendientes = $('Pendientes de plantilla').all().map((i) => i.json).filter((p) => p.lead_id);
const respuestas = $input.all().map((i) => leerKommo(i.json));
const leads = new Map(respuestas.flatMap((r) => (r._embedded && r._embedded.leads) || []).map((l) => [Number(l.id), l]));
const eventos = respuestas.flatMap((r) => (r._embedded && r._embedded.events) || []);
const salida = [];
for (const p of pendientes) {
  const lead = leads.get(Number(p.lead_id));
  if (!lead || !ETAPAS_AGENTE.has(Number(lead.status_id))) continue;
  const etiquetas = etiquetasDe(lead);
  if (etiquetas.includes('Atender persona') || etiquetas.includes('Agente pausado')) continue;
  const desde = new Date(p.ult_seguimiento).getTime() / 1000 + 120;
  if (eventos.some((e) => Number(e.entity_id) === Number(p.lead_id) && Number(e.created_at) > desde)) continue;
  salida.push({ json: { lead_id: lead.id,
    bot: [{ bot_id: BOT_PLANTILLA, entity_id: lead.id, entity_type: 2 }],
    guardar: { lead_id: lead.id, rol: 'agente', tipo: 'plantilla', texto: TEXTO, momento: new Date().toISOString() } } });
}
return salida;

// == Pedidos recordatorio (Code, una vez para todos los elementos)
// Recordatorio de reunión (plantilla "Recordatorio de reunión WIP", Salesbot __BOT_RECORDATORIO__): de 7 a. m. a 7 p. m. pide a
// Calendly las citas de hoy que empiezan en más de 45 minutos (sale de "Usuario Calendly", que ya consulta F2).
const usuario = ($input.first().json.resource || {}).uri;
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
if (!usuario || hora < 7 || hora >= 19) return [];
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const desde = new Date(Date.now() + 45 * 60000).toISOString();
const hasta = new Date(`${hoy}T23:59:59-05:00`).toISOString();
return [{ json: { url: `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(usuario)}&status=active&count=100&min_start_time=${encodeURIComponent(desde)}&max_start_time=${encodeURIComponent(hasta)}` } }];

// == Armar recordatorios (Code, una vez para todos los elementos)
// Cruza las citas de hoy con las que F2 ya pasó a Kommo (calendly_kommo, sin recordatorio) y arma un envío por oportunidad.
const BOT_RECORDATORIO = __BOT_RECORDATORIO__;
const citas = ($('Citas de hoy (recordatorio)').first().json.collection || []);
const registro = $input.all().map((i) => i.json).filter((r) => r.evento && r.kommo_lead_id);
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', timeStyle: 'short' });
const vistos = new Set();
const salida = [];
for (const c of citas) {
  for (const r of registro.filter((x) => x.evento === c.uri)) {
    if (vistos.has(r.kommo_lead_id)) continue;
    vistos.add(r.kommo_lead_id);
    salida.push({ json: { lead_id: r.kommo_lead_id, evento: c.uri,
      bot: [{ bot_id: BOT_RECORDATORIO, entity_id: r.kommo_lead_id, entity_type: 2 }],
      marcar: { recordatorio: new Date().toISOString() },
      guardar: { lead_id: r.kommo_lead_id, rol: 'agente', tipo: 'recordatorio', momento: new Date().toISOString(),
        texto: `Hola ✋ Te recordamos tu reunión con WIP de hoy (${hora.format(new Date(c.start_time))}). Si necesitas cambiar el horario, responde este mensaje. [Plantilla de WhatsApp]` } } });
  }
}
return salida;
