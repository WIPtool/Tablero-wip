// n8n · F12 · Calificador: lee con Claude las conversaciones de WhatsApp que cambiaron y llena en Kommo sector, si encaja en el
// perfil de cliente, calificación A/B/C, tipo de servicio, servicios al mes, operación, país y un resumen.
// armar-flujo.cjs toma cada parte por su marca "// ==" y reemplaza __SUPABASE__.
// Cada hora (8 a. m. a 8 p. m.): oportunidades con mensajes nuevos de la persona en las últimas 2 horas (agente_mensajes), en etapas
// abiertas del embudo de ventas, hasta 15 por hora. El historial sale de agente_mensajes (lo que se guardó desde que existe el agente).

// == Trabajos calificador (Code, una vez para todos los elementos)
const SUPABASE = '__SUPABASE__';
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
if (hora < 8 || hora >= 20) return [];
const desde = new Date(Date.now() - 2 * 3600000).toISOString();
return [{ json: { url: `${SUPABASE}/rest/v1/agente_mensajes?select=lead_id&rol=eq.cliente&momento=gte.${desde}&limit=1000` } }];

// == Pedidos calificador (Code, una vez para todos los elementos)
const ids = [...new Set($input.all().map((i) => i.json.lead_id).filter(Boolean))].slice(0, 60);
if (!ids.length) return [];
return [{ json: { url: `https://wiptool.kommo.com/api/v4/leads?limit=250&${ids.map((id) => `filter[id][]=${id}`).join('&')}` } }];

// == Elegir a calificar (Code, una vez para todos los elementos)
// Solo embudo de ventas en etapas abiertas, y a lo sumo 15 por hora.
const SUPABASE = '__SUPABASE__';
const EMBUDO = 14551307, ABIERTAS = new Set([112413247, 112413251, 112730823, 112413255, 112413259, 112730827, 112413263, 112418871]);
const r = $input.first().json;
const datos = typeof r.data === 'string' ? (() => { try { return JSON.parse(r.data); } catch (e) { return {}; } })() : r;
const leads = ((datos._embedded && datos._embedded.leads) || []).filter((l) => l.pipeline_id === EMBUDO && ABIERTAS.has(l.status_id)).slice(0, 15);
return leads.map((l) => ({ json: { lead_id: l.id, nombre: l.name,
  url: `${SUPABASE}/rest/v1/agente_mensajes?select=rol,texto,momento,tipo&lead_id=eq.${l.id}&tipo=neq.sin_seguimiento&order=momento.asc&limit=60` } }));

// == Pedido a Claude (calificador) (Code, una vez por cada elemento)
const MODELO = 'claude-sonnet-5-5';
const yo = $('Elegir a calificar').item.json;
const r = $json;
const filas = Array.isArray(r) ? r : (Array.isArray(r.data) ? r.data : (typeof r.data === 'string' ? JSON.parse(r.data) : []));
const historial = filas.map((h) => `${h.rol === 'cliente' ? 'Cliente' : 'WIP'}: ${String(h.texto || '').replace(/\s+/g, ' ').slice(0, 600)}`).join('\n').slice(-12000);
const SECTORES = ['Grúas', 'Asistencias', 'Salud y asistencia médica', 'Laboratorio clínico', 'Mantenimiento', 'Instalaciones', 'Internet y telecomunicaciones', 'Limpieza', 'Funeraria', 'Servicio técnico', 'Transporte', 'Domicilios y mensajería', 'Ventas y distribución', 'Taxis', 'Otro'];
const sistema = `Calificas leads de WIP, un software para gestionar servicios en campo (el equipo recibe y cierra servicios en una app, la empresa ve en tiempo real ubicación, tiempos, fotos, firmas y reportes).
Perfil de cliente de WIP (encaja = "si"): empresas que prestan servicios en campo con técnicos u operarios: grúas, asistencias (vial, hogar, exequial), salud y asistencia médica (ambulancias, salud ocupacional), laboratorios clínicos, mantenimientos, instalaciones, internet y telecomunicaciones (ISP que instalan), limpieza, funerarias, servicio técnico y reparaciones, transporte de pasajeros o de carga (no taxis).
Fuera de perfil (encaja = "no"): domicilios, delivery, última milla, mensajería, envíos, distribución, venta TAT, vendedores o fuerza de ventas, cobranza, taxis y mototaxis, y quien no tiene empresa ni operación en campo.
Si la conversación no dice a qué se dedica la empresa, encaja = "por_confirmar".
Calificación: A = encaja y mostró interés concreto (pidió precio, demo o información, dio su correo, contó volumen o equipo); B = encaja pero la conversación quedó al inicio; C = no encaja o no hay datos suficientes.
tipo_servicio: frase corta en minúsculas que complete "los servicios de ___ de tu empresa" (por ejemplo "grúas", "mantenimiento de aires acondicionados", "internet"); vacío si no se sabe.
Usa solo lo que dice la conversación; no inventes datos.`;
return { json: { lead_id: yo.lead_id, pedido: {
  model: MODELO, max_tokens: 600, system: sistema,
  tools: [{ name: 'calificar', description: 'Guarda la calificación del lead', input_schema: { type: 'object', properties: {
    sector: { type: 'string', enum: SECTORES }, encaja: { type: 'string', enum: ['si', 'no', 'por_confirmar'] },
    calificacion: { type: 'string', enum: ['A', 'B', 'C'] }, tipo_servicio: { type: 'string' },
    servicios_mes: { type: ['integer', 'null'] }, operacion: { type: ['string', 'null'], enum: ['propio', 'terceros', 'ambos', null] },
    pais: { type: ['string', 'null'] }, resumen: { type: 'string', description: 'Una o dos frases: qué empresa es, qué necesita y en qué quedó.' },
  }, required: ['sector', 'encaja', 'calificacion', 'resumen'] } }],
  tool_choice: { type: 'tool', name: 'calificar' },
  messages: [{ role: 'user', content: `Conversación de WhatsApp con el lead "${yo.nombre || ''}":\n\n${historial || '(sin mensajes guardados)'}` }],
} } };

// == Calificación en Kommo (Code, una vez por cada elemento)
const SECTOR = { 'Grúas': 454306, 'Asistencias': 454308, 'Salud y asistencia médica': 454310, 'Laboratorio clínico': 454312, 'Mantenimiento': 454314, 'Instalaciones': 454316,
  'Internet y telecomunicaciones': 454318, 'Limpieza': 454320, 'Funeraria': 454322, 'Servicio técnico': 454324, 'Transporte': 454326, 'Domicilios y mensajería': 454328,
  'Ventas y distribución': 454330, 'Taxis': 454332, 'Otro': 454334 };
const ENCAJA = { si: 454336, no: 454338, por_confirmar: 454340 }, CALIFICACION = { A: 454342, B: 454344, C: 454346 }, OPERACION = { propio: 454348, terceros: 454350, ambos: 454352 };
const CAMPO = { sector: 555776, encaja: 555778, calificacion: 555780, servicios: 555782, operacion: 555784, pais: 555786, resumen: 555788, calificado: 555790, tipo: 554680 };
const lead_id = $('Pedido a Claude (calificador)').item.json.lead_id;
const uso = (($json.content || []).find((c) => c.type === 'tool_use') || {}).input;
if (!uso) return { json: { lead_id, omitir: true } };
const v = (id, valor) => ({ field_id: id, values: [valor] });
const campos = [v(CAMPO.encaja, { enum_id: ENCAJA[uso.encaja] }), v(CAMPO.calificacion, { enum_id: CALIFICACION[uso.calificacion] }),
  v(CAMPO.resumen, { value: String(uso.resumen || '').slice(0, 1000) }), v(CAMPO.calificado, { value: Math.floor(Date.now() / 1000) })];
if (SECTOR[uso.sector]) campos.push(v(CAMPO.sector, { enum_id: SECTOR[uso.sector] }));
if (uso.tipo_servicio) campos.push(v(CAMPO.tipo, { value: String(uso.tipo_servicio).toLowerCase().slice(0, 80) }));
if (Number.isFinite(uso.servicios_mes)) campos.push(v(CAMPO.servicios, { value: uso.servicios_mes }));
if (OPERACION[uso.operacion]) campos.push(v(CAMPO.operacion, { enum_id: OPERACION[uso.operacion] }));
if (uso.pais) campos.push(v(CAMPO.pais, { value: String(uso.pais).slice(0, 60) }));
return { json: { lead_id, cuerpo: [{ id: lead_id, custom_fields_values: campos }] } };
