// n8n · F12 · ciclo de vida del lead: Retomador y Depurador. armar-flujo.cjs toma cada parte por su marca "// ==" y reemplaza
// __SUPABASE__ y __BOTS_RETOME__ (Salesbots de las plantillas de retome).
// Cada hora, de 8 a. m. a 8 p. m. (hora Colombia), revisa las oportunidades en "Sin respuesta (retomar)", "Reunión agendada" y
// "Propuesta enviada":
//  - Sin respuesta: si no encaja en el perfil o respondió "Ahora no" / "No, gracias", se cierra como Perdido (con motivo) y, si tiene
//    correo, pasa a la nutrición de Brevo. Solo se retoman los leads que encajan con calificación A o B (los "por confirmar" y C no
//    reciben retomes). Cadencia: primer retome a los 7 días sin escribir, segundo 15 días después, y luego uno cada 30 días hasta
//    completar 6; 30 días después del sexto, Perdido "Sin respuesta". Si la persona escribe después de un retome, el ciclo vuelve a
//    empezar cuando se enfríe de nuevo.
//    Cada retome habla de algo distinto de WIP y nunca repite una plantilla: si el lead tiene Reto, el primero lo menciona (R) y los
//    siguientes recorren los módulos empezando por el que resuelve ese reto (por palabras clave, sin llamar a Claude); si no tiene,
//    el primero es genérico (G). Mientras una plantilla no tenga Salesbot (null en BOTS), se usan las de antes (A o B) una sola vez y
//    el resto espera.
//  - Atender persona / Agente pausado en Sin respuesta: no se les envía plantilla; tarea para que alguien del equipo los retome
//    (una vez cada 30 días).
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
// Cuándo entró cada oportunidad a su etapa (kommo_cambio_etapa), quién respondió "Ahora no" / "No, gracias" a un retome y qué
// plantillas se le enviaron a cada una (para no repetirlas).
const SUPABASE = '__SUPABASE__';
const leer = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const ids = $('Leads del ciclo').all().flatMap((i) => (leer(i.json)._embedded || {}).leads || []).map((l) => l.id);
if (!ids.length) return [];
const desde = new Date(Date.now() - 60 * 86400000).toISOString();
const negativas = encodeURIComponent('(texto.ilike.*ahora no*,texto.ilike.*no, gracias*,texto.ilike.*no gracias*)');
return [
  { json: { url: `${SUPABASE}/rest/v1/kommo_cambio_etapa?select=lead_id,a_etapa,momento&lead_id=in.(${ids.join(',')})&order=momento.desc&limit=5000` } },
  { json: { url: `${SUPABASE}/rest/v1/agente_mensajes?select=lead_id,texto,momento&rol=eq.cliente&momento=gte.${desde}&or=${negativas}&limit=5000` } },
  { json: { url: `${SUPABASE}/rest/v1/agente_mensajes?select=lead_id,texto,tipo&tipo=eq.plantilla&lead_id=in.(${ids.join(',')})&limit=5000` } },
];

// == Armar ciclo (Code, una vez para todos los elementos)
const EMBUDO = 14551307, SIN_RESPUESTA = 112730823, REUNION_AGENDADA = 112413255, PROPUESTA = 112730827, PERDIDO = 143;
const MOTIVO = { sinRespuesta: 39246947, fueraDePerfil: 39246951, noInteresa: 39246955, noAsistio: 39246959 };
const CAMPO = { tipo: 554680, encaja: 555778, calificacion: 555780, retomes: 555792, ultimoRetome: 555794, reto: 537464 };
const ENCAJA = { 454336: 'si', 454338: 'no', 454340: 'por_confirmar' };
const CALIFICACION = { 454342: 'A', 454344: 'B', 454346: 'C' };
const BOTS = __BOTS_RETOME__; // Salesbot de cada plantilla (null si aún no existe o no está aprobada)
const LISTA_NUTRICION = 21;
const MAX_RETOMES = 40; // por hora, para no enviar todo de una vez
const TOPE_RETOMES = 6; // 7 días, +15 y luego cada 30 días
const DIA = 86400, ahora = Math.floor(Date.now() / 1000);
const leer = (j) => { if (j && typeof j.data === 'string') { try { return JSON.parse(j.data); } catch (e) { return {}; } } return j || {}; };
const leads = $('Leads del ciclo').all().flatMap((i) => (leer(i.json)._embedded || {}).leads || []);
const kommo = $('Datos Kommo (ciclo)').all().map((i) => leer(i.json));
const eventos = kommo.flatMap((d) => (d._embedded && d._embedded.events) || []);
const contactos = new Map(kommo.flatMap((d) => (d._embedded && d._embedded.contacts) || []).map((c) => [c.id, c]));
const supa = $('Datos Supabase (ciclo)').all().map((i) => i.json).filter((r) => r && r.lead_id);
const cambios = supa.filter((r) => r.a_etapa);
const negativas = supa.filter((r) => r.texto && !r.tipo);
const plantillas = supa.filter((r) => r.tipo === 'plantilla');
// Sin mensajes no se puede saber quién está callado: si la consulta a Kommo falló, no se toca nada.
if (!eventos.length) return [];

const campo = (l, id) => { const f = (l.custom_fields_values || []).find((x) => x.field_id === id); return f && f.values && f.values[0] ? f.values[0] : null; };
const correoDe = (c) => ((c && c.custom_fields_values) || []).filter((f) => f.field_code === 'EMAIL').flatMap((f) => f.values || []).map((v) => String(v.value).trim()).find(Boolean) || '';
const BOTONES = 'con botones Quiero verlo, Info a mi correo y Ahora no';
const TEXTO = {
  // Plantillas de antes (A y B se siguen usando mientras se aprueban las nuevas; C, D y E ya no se envían).
  A: (t) => `Hola ✋ Hace unos días hablamos de cómo organizar los servicios de ${t} de tu empresa. ¿Pudiste pensar en tomar WIP? En 30 minutos te mostramos cómo tu equipo recibe los servicios en el celular y tú ves en tiempo real dónde va cada uno, con fotos y firmas al cerrar. [Plantilla de WhatsApp para retomar la conversación, con botones Agendar reunión, Info a mi correo y Ahora no]`,
  B: (t) => `Hola ✋ Te escribimos de WIP. ¿Siguen manejando sus servicios de ${t} por Excel y WhatsApp? Con WIP asignas, sigues y cierras cada servicio desde una sola app, y ves en tiempo real lo que hace tu equipo en campo. ¿Te mostramos cómo funciona? [Plantilla de WhatsApp para retomar la conversación, con botones Agendar reunión, Info a mi correo y Ahora no]`,
  // Plantillas nuevas: la marca "[Plantilla de retome X" al final es la que permite saber cuáles ya se enviaron.
  R: (t, reto) => `Nos quedamos pensando en lo que nos contaste de tu operación: ${reto}. Eso es justo lo que resolvemos en WIP, y en 30 minutos te mostramos cómo quedaría en tu empresa. ¿Lo vemos? [Plantilla de retome R, ${BOTONES}]`,
  G: () => `Desde WIP queremos retomar lo que hablamos. Ayudamos a empresas de servicios en campo a que su equipo reciba y cierre cada servicio en el celular, mientras ven en tiempo real cómo va cada uno. ¿Te mostramos cómo funcionaría en la tuya? [Plantilla de retome G, ${BOTONES}]`,
  seguimiento: () => `¿Sabes en este momento dónde va cada persona de tu equipo? En WIP lo ves en un mapa, con la hora estimada de llegada a cada servicio, sin llamar a nadie. ¿Te mostramos cómo se ve? [Plantilla de retome seguimiento, ${BOTONES}]`,
  asignacion: () => `Asignar un servicio en WIP toma segundos: ves quién está libre y más cerca, y el servicio le llega a su app con la dirección, los datos y lo que hay que hacer. ¿Te mostramos cómo funciona? [Plantilla de retome asignacion, ${BOTONES}]`,
  evidencia: () => `Fotos, firma del cliente y formulario, todo desde el celular: así se cierra cada servicio en WIP, y el reporte queda listo al instante. Nada de fotos perdidas en el WhatsApp. ¿Quieres verlo? [Plantilla de retome evidencia, ${BOTONES}]`,
  aviso_cliente: () => `Que tu cliente no tenga que llamar a preguntar: con WIP recibe por WhatsApp quién va, a qué hora llega y una encuesta al terminar. ¿Te contamos cómo se configura? [Plantilla de retome aviso_cliente, ${BOTONES}]`,
  indicadores: () => `Un tablero con lo que pasa en tu operación: en WIP ves en vivo los servicios a tiempo, los atrasados y el rendimiento de cada técnico. ¿Te lo mostramos? [Plantilla de retome indicadores, ${BOTONES}]`,
  tarifas: () => `Cierre de mes sin Excel: en WIP la tarifa y la liquidación de cada servicio se calculan solas, y los reportes para tus clientes salen con un clic. ¿Quieres verlo? [Plantilla de retome tarifas, ${BOTONES}]`,
};
// Cómo reconocer en agente_mensajes las plantillas de antes (no tenían marca).
const ANTERIORES = [['A', 'Hola ✋ Hace unos días hablamos'], ['B', 'Hola ✋ Te escribimos de WIP'], ['C', 'Hola ✋ Hace unos días escribiste'], ['D', 'Hola ✋ No queremos llenarte']];
const enviadasA = (id) => new Set(plantillas.filter((p) => Number(p.lead_id) === Number(id)).map((p) => {
  const t = String(p.texto || '');
  const marca = t.match(/\[Plantilla de retome (\w+)/);
  if (marca) return marca[1];
  const vieja = ANTERIORES.find(([, prefijo]) => t.startsWith(prefijo));
  return vieja ? vieja[0] : null;
}).filter(Boolean));
// Módulo de WIP que resuelve el reto, por palabras clave (el primero que coincide).
const MODULOS = ['seguimiento', 'asignacion', 'evidencia', 'aviso_cliente', 'indicadores', 'tarifas'];
const CLAVES_RETO = [
  ['seguimiento', /ubicaci|tiempo real|visibilidad|rastre|gps|d[oó]nde (va|est)|seguimiento|mapa|monitore/],
  ['evidencia', /foto|firma|evidencia|acta|formulario|papel|soporte|informe/],
  ['aviso_cliente', /cliente final|avis|notific|llaman|preguntan|a qu[eé] hora|comunicaci[oó]n con|encuesta|satisfacci/],
  ['tarifas', /tarifa|factur|cobr|liquid|pago|costo|n[oó]mina|fin de mes/],
  ['indicadores', /indicador|kpi|sla|productividad|rendimiento|medir|m[eé]trica|tiempos? de (respuesta|atenci)|cumplimiento/],
  ['asignacion', /asign|despach|program|agend|disponib|ruta|coordin|excel|whatsapp|desorden|centraliz|papeleo/],
];
const moduloDe = (reto) => { const m = CLAVES_RETO.find(([, re]) => re.test(reto.toLowerCase())); return m ? m[0] : null; };

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
  const etiquetas = ((l._embedded && l._embedded.tags) || []).map((t) => t.name);
  // "Atención manual": casos que lleva una persona (clientes en prueba, contactos conocidos, duplicados); el ciclo no los toca.
  if (etiquetas.includes('Atención manual')) continue;
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
    const calificacion = CALIFICACION[(campo(l, CAMPO.calificacion) || {}).enum_id] || '';
    // "Ahora no" / "No, gracias" como último mensaje de la persona (después del último retome).
    const negativa = negativas.find((n) => Number(n.lead_id) === Number(l.id) && Math.abs(new Date(n.momento).getTime() / 1000 - ultEntrada) < 600);
    if (encaja === 'no') { cerrar(l, MOTIVO.fueraDePerfil, 'Cerrado por el ciclo automático: fuera del perfil de cliente de WIP' + (correo ? '. Sigue en la nutrición por correo.' : '.'), correo); contar('fuera_de_perfil'); continue; }
    if (negativa) { cerrar(l, MOTIVO.noInteresa, `Cerrado por el ciclo automático: respondió "${negativa.texto}" al retome` + (correo ? '. Sigue en la nutrición por correo.' : '.'), correo); contar('no_le_interesa'); continue; }
    const desdeRetome = ultimoToque ? (ahora - ultimoToque) / DIA : Infinity;
    // Meli le pasó la conversación a una persona: la plantilla la despertaría y nadie le contestaría. Tarea en vez de mensaje.
    if (etiquetas.includes('Atender persona') || etiquetas.includes('Agente pausado')) {
      if (callado >= 7 && desdeRetome >= 30) { tarea(l, 'Retomar personalmente: está en Sin respuesta y Meli la había pasado a una persona (Atender persona).'); contar('tarea_atender_persona'); }
      continue;
    }
    // Solo buenos leads: encajan en el perfil con calificación A o B.
    if (encaja !== 'si' || !['A', 'B'].includes(calificacion)) { contar('sin_retome_no_calificado'); continue; }
    // Si escribió después del último retome, el ciclo vuelve a empezar (las plantillas ya enviadas igual no se repiten).
    const hechos = Number((campo(l, CAMPO.retomes) || {}).value || 0);
    const paso = ultimoToque && ultEntrada > ultimoToque ? 0 : hechos;
    if (paso >= TOPE_RETOMES && desdeRetome >= 30) { cerrar(l, MOTIVO.sinRespuesta, `Cerrado por el ciclo automático: no responde hace ${Math.floor(callado)} días después de ${paso} retomes.`, correo); contar('sin_respuesta'); continue; }
    if (retomes >= MAX_RETOMES || callado < 7) continue;
    const toca = paso === 0 || (paso === 1 && desdeRetome >= 15) || (paso >= 2 && paso < TOPE_RETOMES && desdeRetome >= 30);
    if (!toca) continue;
    const tipo = String((campo(l, CAMPO.tipo) || {}).value || '').trim();
    const reto = String((campo(l, CAMPO.reto) || {}).value || '').trim().replace(/[.。]+$/, '');
    const modulo = reto ? moduloDe(reto) : null;
    const secuencia = [reto ? 'R' : 'G', ...(modulo ? [modulo, ...MODULOS.filter((m) => m !== modulo)] : MODULOS)];
    const enviadas = enviadasA(l.id);
    let plantilla = secuencia.find((k) => !enviadas.has(k) && BOTS[k]) || null;
    // Mientras las nuevas no estén aprobadas: A o B una sola vez (A y B necesitan el tipo de servicio).
    if (!plantilla && tipo && !enviadas.has('A') && !enviadas.has('B')) plantilla = BOTS[calificacion] ? calificacion : null;
    if (!plantilla) { contar('retome_en_espera'); continue; }
    // Si ya tuvo reunión o propuesta, el mensaje genérico no tiene sentido: tarea para retomarlo personalmente.
    const avanzado = cambios.some((c) => Number(c.lead_id) === Number(l.id) && [REUNION_AGENDADA, 112413259, PROPUESTA, 112413263].includes(Number(c.a_etapa)));
    if (avanzado && plantilla === 'G') {
      if (desdeRetome >= 30) { tarea(l, 'Retomar personalmente: ya tuvo reunión o propuesta y está en Sin respuesta.'); contar('tarea_retomar_avanzado'); }
      continue;
    }
    retomes++;
    salida.bots.push({ bot_id: BOTS[plantilla], entity_id: l.id, entity_type: 2 });
    salida.leads.push({ id: l.id, custom_fields_values: [{ field_id: CAMPO.retomes, values: [{ value: paso + 1 }] }, { field_id: CAMPO.ultimoRetome, values: [{ value: ahora }] }] });
    salida.filas.push({ lead_id: l.id, rol: 'agente', tipo: 'plantilla', texto: TEXTO[plantilla](tipo, reto), momento: new Date().toISOString() });
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
