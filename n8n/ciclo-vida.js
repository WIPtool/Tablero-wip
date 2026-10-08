// n8n · F12 · ciclo de vida del lead: Retomador y Depurador. armar-flujo.cjs toma cada parte por su marca "// ==" y reemplaza
// __SUPABASE__ y __BOTS_RETOME__ (Salesbots de las plantillas de retome).
// Cada hora, de 8 a. m. a 8 p. m. (hora Colombia), revisa las oportunidades en "Sin respuesta (retomar)", "Reunión agendada" y
// "Propuesta enviada":
//  - Sin respuesta: si no encaja en el perfil o respondió "Ahora no" / "No, gracias", se cierra como Perdido (con motivo) y, si tiene
//    correo, pasa a la nutrición de Brevo. Si encaja o está por confirmar: primer retome a los 7 días sin escribir, segundo a los 21
//    (y al menos 7 días después del primero) y Perdido "Sin respuesta" a los 30 (y 7 días después del segundo).
//  - Reunión agendada: a los 4 días en la etapa, tarea para confirmar si se hizo o reagendar; a los 11, si no ha escrito en 7 días,
//    Perdido "No asistió a la reunión".
//  - Propuesta enviada: a los 7 días en la etapa, tarea de seguimiento; a los 30, si no ha escrito en 30 días, Perdido "Sin respuesta".
// Cada retome se registra en agente_mensajes (tipo plantilla) para que Meli siga la conversación cuando respondan.
// Las oportunidades con la etiqueta "Atención manual" no se tocan.

// == Trabajos ciclo (Code, una vez para todos los elementos)
const EMBUDO = 14551307, ETAPAS = [112730823, 112413255, 112730827];
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
if (hora < 8 || hora >= 20) return [];
const K = 'https://wiptool.kommo.com/api/v4/leads?limit=250&with=contacts';
return ETAPAS.flatMap((st) => [1, 2].map((p) => ({ json: { url: `${K}&page=${p}&filter[statuses][0][pipeline_id]=${EMBUDO}&filter[statuses][0][status_id]=${st}` } })));

// == Pedidos Kommo ciclo (Code, una vez para todos los elementos)
// Mensajes de WhatsApp de los últimos 60 días (Kommo filtra los eventos de chat por contacto y rechaza muchos a la vez: de a 10)
// y los datos de los contactos (correo, para la nutrición de Brevo).
const leer = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const leads = $input.all().flatMap((i) => (leer(i.json)._embedded || {}).leads || []);
if (!leads.length) return [];
const contactos = [...new Set(leads.map((l) => ((l._embedded && l._embedded.contacts) || [])[0]).filter(Boolean).map((c) => c.id))];
const desde = Math.floor(Date.now() / 1000) - 60 * 86400;
const pedidos = [];
for (let i = 0; i < contactos.length; i += 10) {
  const filtro = contactos.slice(i, i + 10).map((id) => `filter[entity_id][]=${id}`).join('&');
  for (const tipo of ['incoming_chat_message', 'outgoing_chat_message']) {
    for (let p = 1; p <= 3; p++) {
      pedidos.push({ json: { url: `https://wiptool.kommo.com/api/v4/events?limit=100&page=${p}&filter[entity]=contact&${filtro}&filter[type][]=${tipo}&filter[created_at][from]=${desde}` } });
    }
  }
}
for (let i = 0; i < contactos.length; i += 50) {
  pedidos.push({ json: { url: `https://wiptool.kommo.com/api/v4/contacts?limit=250&${contactos.slice(i, i + 50).map((id) => `filter[id][]=${id}`).join('&')}` } });
}
return pedidos;

// == Pedidos Supabase ciclo (Code, una vez para todos los elementos)
// Cuándo entró cada oportunidad a su etapa (kommo_cambio_etapa) y quién respondió "Ahora no" / "No, gracias" a un retome.
const SUPABASE = '__SUPABASE__';
const leer = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const ids = $('Leads del ciclo').all().flatMap((i) => (leer(i.json)._embedded || {}).leads || []).map((l) => l.id);
if (!ids.length) return [];
const desde = new Date(Date.now() - 60 * 86400000).toISOString();
const negativas = encodeURIComponent('(texto.ilike.*ahora no*,texto.ilike.*no, gracias*,texto.ilike.*no gracias*)');
return [
  { json: { url: `${SUPABASE}/rest/v1/kommo_cambio_etapa?select=lead_id,a_etapa,momento&lead_id=in.(${ids.join(',')})&order=momento.desc&limit=5000` } },
  { json: { url: `${SUPABASE}/rest/v1/agente_mensajes?select=lead_id,texto,momento&rol=eq.cliente&momento=gte.${desde}&or=${negativas}&limit=5000` } },
];

// == Armar ciclo (Code, una vez para todos los elementos)
const EMBUDO = 14551307, SIN_RESPUESTA = 112730823, REUNION_AGENDADA = 112413255, PROPUESTA = 112730827, PERDIDO = 143;
const MOTIVO = { sinRespuesta: 39246947, fueraDePerfil: 39246951, noInteresa: 39246955, noAsistio: 39246959 };
const CAMPO = { tipo: 554680, encaja: 555778, calificacion: 555780, retomes: 555792, ultimoRetome: 555794 };
const ENCAJA = { 454336: 'si', 454338: 'no', 454340: 'por_confirmar' };
const CALIFICACION_A = 454342;
const BOTS = __BOTS_RETOME__; // { A, B, C, D, E }: Salesbot de cada plantilla (null si aún no existe)
const LISTA_NUTRICION = 21;
const MAX_RETOMES = 40; // por hora, para no enviar todo de una vez
const DIA = 86400, ahora = Math.floor(Date.now() / 1000);
const leer = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const leads = $('Leads del ciclo').all().flatMap((i) => (leer(i.json)._embedded || {}).leads || []);
const kommo = $('Datos Kommo (ciclo)').all().map((i) => leer(i.json));
const eventos = kommo.flatMap((d) => (d._embedded && d._embedded.events) || []);
const contactos = new Map(kommo.flatMap((d) => (d._embedded && d._embedded.contacts) || []).map((c) => [c.id, c]));
const supa = $('Datos Supabase (ciclo)').all().map((i) => i.json).filter((r) => r && r.lead_id);
const cambios = supa.filter((r) => r.a_etapa);
const negativas = supa.filter((r) => r.texto);
// Sin mensajes no se puede saber quién está callado: si la consulta a Kommo falló, no se toca nada.
if (!eventos.length) return [];

const campo = (l, id) => { const f = (l.custom_fields_values || []).find((x) => x.field_id === id); return f && f.values && f.values[0] ? f.values[0] : null; };
const correoDe = (c) => ((c && c.custom_fields_values) || []).filter((f) => f.field_code === 'EMAIL').flatMap((f) => f.values || []).map((v) => String(v.value).trim()).find(Boolean) || '';
const TEXTO = {
  A: (t) => `Hola ✋ Hace unos días hablamos de cómo organizar los servicios de ${t} de tu empresa. ¿Pudiste pensar en tomar WIP? En 30 minutos te mostramos cómo tu equipo recibe los servicios en el celular y tú ves en tiempo real dónde va cada uno, con fotos y firmas al cerrar. [Plantilla de WhatsApp para retomar la conversación, con botones Agendar reunión, Info a mi correo y Ahora no]`,
  B: (t) => `Hola ✋ Te escribimos de WIP. ¿Siguen manejando sus servicios de ${t} por Excel y WhatsApp? Con WIP asignas, sigues y cierras cada servicio desde una sola app, y ves en tiempo real lo que hace tu equipo en campo. ¿Te mostramos cómo funciona? [Plantilla de WhatsApp para retomar la conversación, con botones Agendar reunión, Info a mi correo y Ahora no]`,
  C: () => 'Hola ✋ Hace unos días escribiste a WIP. ¿Tu empresa presta servicios en campo, como instalaciones, mantenimientos, asistencias, grúas o transporte? Si aún los manejan por Excel y WhatsApp, te mostramos cómo organizarlos con WIP. [Plantilla de WhatsApp para retomar la conversación, con botones Sí, cuéntame más y Ahora no]',
  D: (t) => `Hola ✋ No queremos llenarte de mensajes, así que este es el último por ahora. Si en algún momento quieres organizar los servicios de ${t} de tu empresa sin Excel ni chats sueltos, en WIP te ayudamos. ¿Te contamos cómo funciona? [Plantilla de WhatsApp, último retome, con botones Agendar reunión, Info a mi correo y No, gracias]`,
  E: () => 'Hola ✋ No queremos llenarte de mensajes, así que este es el último por ahora. Si tu empresa presta servicios en campo y quiere organizarlos sin Excel ni chats sueltos, en WIP te ayudamos. ¿Te contamos cómo funciona? [Plantilla de WhatsApp, último retome, con botones Sí, cuéntame más y No, gracias]',
};

const salida = { leads: [], notas: [], tareas: [], bots: [], filas: [], brevo: [], resumen: {} };
const contar = (k) => { salida.resumen[k] = (salida.resumen[k] || 0) + 1; };
const cerrar = (l, motivo, texto, correo) => {
  salida.leads.push({ id: l.id, pipeline_id: EMBUDO, status_id: PERDIDO, loss_reason_id: motivo });
  salida.notas.push({ entity_id: l.id, note_type: 'common', params: { text: texto } });
  if (correo) salida.brevo.push({ email: correo, listIds: [LISTA_NUTRICION], updateEnabled: true });
};
const tarea = (l, texto) => {
  salida.tareas.push({ entity_id: l.id, entity_type: 'leads', responsible_user_id: l.responsible_user_id, task_type_id: 1, text: texto, complete_till: ahora + DIA });
  salida.leads.push({ id: l.id, custom_fields_values: [{ field_id: CAMPO.ultimoRetome, values: [{ value: ahora }] }] });
};
let retomes = 0;

for (const l of leads) {
  if (l.pipeline_id !== EMBUDO) continue;
  // "Atención manual": casos que lleva una persona (clientes en prueba, contactos conocidos, duplicados); el ciclo no los toca.
  if (((l._embedded && l._embedded.tags) || []).some((t) => t.name === 'Atención manual')) continue;
  const contacto = ((l._embedded && l._embedded.contacts) || [])[0];
  const suyos = eventos.filter((e) => (e.entity_type === 'lead' && Number(e.entity_id) === Number(l.id))
    || (contacto && e.entity_type === 'contact' && Number(e.entity_id) === Number(contacto.id)));
  const entrantes = suyos.filter((e) => e.type === 'incoming_chat_message').map((e) => e.created_at);
  const ultEntrada = entrantes.length ? Math.max(...entrantes) : l.created_at;
  const callado = (ahora - ultEntrada) / DIA;
  const entrada = cambios.filter((c) => Number(c.lead_id) === Number(l.id) && Number(c.a_etapa) === Number(l.status_id))
    .map((c) => Math.floor(new Date(c.momento).getTime() / 1000))[0] || null;
  const enEtapa = entrada ? (ahora - entrada) / DIA : null;
  const ult = campo(l, CAMPO.ultimoRetome);
  const ultimoToque = ult ? Number(ult.value) : 0;
  const correo = correoDe(contactos.get(contacto && contacto.id));

  if (l.status_id === SIN_RESPUESTA) {
    const encaja = ENCAJA[(campo(l, CAMPO.encaja) || {}).enum_id] || 'por_confirmar';
    // "Ahora no" / "No, gracias" como último mensaje de la persona (después del último retome).
    const negativa = negativas.find((n) => Number(n.lead_id) === Number(l.id) && Math.abs(new Date(n.momento).getTime() / 1000 - ultEntrada) < 600);
    if (encaja === 'no') { cerrar(l, MOTIVO.fueraDePerfil, 'Cerrado por el ciclo automático: fuera del perfil de cliente de WIP' + (correo ? '. Sigue en la nutrición por correo.' : '.'), correo); contar('fuera_de_perfil'); continue; }
    if (negativa) { cerrar(l, MOTIVO.noInteresa, `Cerrado por el ciclo automático: respondió "${negativa.texto}" al retome` + (correo ? '. Sigue en la nutrición por correo.' : '.'), correo); contar('no_le_interesa'); continue; }
    const hechos = Number((campo(l, CAMPO.retomes) || {}).value || 0);
    const desdeRetome = ultimoToque ? (ahora - ultimoToque) / DIA : Infinity;
    if (hechos >= 2 && callado >= 30 && desdeRetome >= 7) { cerrar(l, MOTIVO.sinRespuesta, `Cerrado por el ciclo automático: no responde hace ${Math.floor(callado)} días después de 2 retomes.`, correo); contar('sin_respuesta'); continue; }
    if (retomes >= MAX_RETOMES || callado < 1) continue;
    const tipo = String((campo(l, CAMPO.tipo) || {}).value || '').trim();
    let plantilla = null;
    if (hechos === 0 && callado >= 7) plantilla = !tipo ? 'C' : ((campo(l, CAMPO.calificacion) || {}).enum_id === CALIFICACION_A ? 'A' : 'B');
    else if (hechos === 1 && callado >= 21 && desdeRetome >= 7) plantilla = tipo ? 'D' : 'E';
    if (!plantilla || !BOTS[plantilla]) continue;
    retomes++;
    salida.bots.push({ bot_id: BOTS[plantilla], entity_id: l.id, entity_type: 2 });
    salida.leads.push({ id: l.id, custom_fields_values: [{ field_id: CAMPO.retomes, values: [{ value: hechos + 1 }] }, { field_id: CAMPO.ultimoRetome, values: [{ value: ahora }] }] });
    salida.filas.push({ lead_id: l.id, rol: 'agente', tipo: 'plantilla', texto: TEXTO[plantilla](tipo), momento: new Date().toISOString() });
    contar('retome_' + plantilla);
  } else if (l.status_id === REUNION_AGENDADA && enEtapa !== null) {
    if (enEtapa >= 11 && callado >= 7) { cerrar(l, MOTIVO.noAsistio, `Cerrado por el ciclo automático: ${Math.floor(enEtapa)} días en Reunión agendada sin pasar a Reunión hecha ni escribir.`, correo); contar('no_asistio'); }
    else if (enEtapa >= 4 && ultimoToque < entrada) { tarea(l, 'Confirmar si la reunión se hizo: pásala a Reunión hecha o reagéndala con el cliente.'); contar('tarea_reunion'); }
  } else if (l.status_id === PROPUESTA && enEtapa !== null) {
    if (enEtapa >= 30 && callado >= 30) { cerrar(l, MOTIVO.sinRespuesta, `Cerrado por el ciclo automático: ${Math.floor(enEtapa)} días con la propuesta enviada sin respuesta.`, correo); contar('propuesta_sin_respuesta'); }
    else if (enEtapa >= 7 && ultimoToque < entrada) { tarea(l, 'Hacer seguimiento a la propuesta: lleva 7 días sin avanzar.'); contar('tarea_propuesta'); }
  }
}
if (!salida.leads.length && !salida.bots.length) return [];
return [{ json: salida }];

// == Contactos Brevo (ciclo) (Code, una vez para todos los elementos)
// Un elemento por correo que pasa a la nutrición de Brevo (lista 21).
const s = $('Armar ciclo').first().json;
return (s.brevo || []).map((c) => ({ json: c }));
