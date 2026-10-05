// n8n · código común para crear o actualizar oportunidades en Kommo (F1 formularios del sitio y F2 citas de Calendly).
// armar-flujo.cjs toma cada parte por su marca "// ==" y reemplaza los nombres de nodo __NORMAL__, __CORREO__, __TELEFONO__ y __ARMAR__.
// Cada elemento que llega de __NORMAL__ trae: clave, nombre, correo, telefono, empresa, dominio, cargo, origen (id de la opción
// del campo Origen), campana, objetivo ('nuevo' o 'reunion'), fecha (opcional), etiqueta, nota, url_correo y url_telefono.
// Reglas: si la persona ya está en Kommo (mismo correo o teléfono) y tiene una oportunidad abierta, no se duplica: se le agrega la
// etiqueta y la nota, y si el objetivo es 'reunion' y estaba en Leads entrantes o Nuevo, pasa a Reunión agendada. Si no, se crea
// la oportunidad (con contacto y empresa si son nuevos) con su Origen. El Origen de una oportunidad que ya existía no se toca.

// == Armar en Kommo (Code, una vez para todos los elementos)
const BASE = 'https://wiptool.kommo.com/api/v4';
const EMBUDO = 14551307, CAMPO_ORIGEN = 421634, CAMPO_CAMPANA = 421636;
const ETAPA = { nuevo: 112413251, reunion: 112413255 };
const TEMPRANAS = new Set([112413247, 112413251]); // Leads entrantes y Nuevo
const CERRADAS = new Set([142, 143]);
const normal = $('__NORMAL__').all();
const porCorreo = $('__CORREO__').all();
const porTelefono = $('__TELEFONO__').all();
// Etapa de cada oportunidad según la última carga del tablero (las creadas en la última hora aún no están: cuentan como tempranas).
const etapaDe = new Map($input.all().map((i) => [Number(i.json.lead_id), Number(i.json.etapa_id)]).filter(([id]) => id));
const cuerpo = (r) => {
  const j = (r && r.json) || {};
  if (typeof j.data !== 'string') return j;
  try { return JSON.parse(j.data); } catch (e) { return {}; }
};
const contactos = (r) => (cuerpo(r)._embedded || {}).contacts || [];
const campo = (code, value, enumCode) => ({ field_code: code, values: [enumCode ? { value, enum_code: enumCode } : { value }] });

return normal.map((n, i) => {
  const f = n.json;
  const base = { clave: f.clave, datos: f };
  const contacto = [...contactos(porCorreo[i]), ...contactos(porTelefono[i])][0];
  // Oportunidad ya identificada (p. ej. la cita viene del enlace del agente de WhatsApp): se actualiza esa, si sigue abierta.
  if (f.kommo_lead && !CERRADAS.has(etapaDe.get(f.kommo_lead))) {
    const id = f.kommo_lead, etapa = etapaDe.get(id);
    const mover = f.objetivo === 'reunion' && (etapa === undefined || TEMPRANAS.has(etapa));
    return { json: { ...base, accion: mover ? 'movida' : 'existente', contacto_id: contacto ? contacto.id : null, kommo_lead_id: id, metodo: 'PATCH', url: `${BASE}/leads`,
      cuerpo: [{ id, tags_to_add: [{ name: f.etiqueta }], ...(mover ? { pipeline_id: EMBUDO, status_id: ETAPA.reunion } : {}) }] } };
  }
  if (contacto) {
    const abiertas = ((contacto._embedded && contacto._embedded.leads) || []).map((l) => l.id)
      .filter((id) => !CERRADAS.has(etapaDe.get(id))).sort((a, b) => b - a);
    if (abiertas[0]) {
      const id = abiertas[0], etapa = etapaDe.get(id);
      const mover = f.objetivo === 'reunion' && (etapa === undefined || TEMPRANAS.has(etapa));
      return { json: { ...base, accion: mover ? 'movida' : 'existente', contacto_id: contacto.id, kommo_lead_id: id, metodo: 'PATCH', url: `${BASE}/leads`,
        cuerpo: [{ id, tags_to_add: [{ name: f.etiqueta }], ...(mover ? { pipeline_id: EMBUDO, status_id: ETAPA.reunion } : {}) }] } };
    }
  }
  const lead = {
    name: f.empresa || f.nombre || f.correo, pipeline_id: EMBUDO, status_id: ETAPA[f.objetivo] || ETAPA.nuevo,
    custom_fields_values: [
      { field_id: CAMPO_ORIGEN, values: [{ enum_id: f.origen }] },
      ...(f.campana ? [{ field_id: CAMPO_CAMPANA, values: [{ value: f.campana }] }] : []),
    ],
    _embedded: { tags: [{ name: f.etiqueta }] },
  };
  if (f.fecha) lead.created_at = Math.floor(new Date(f.fecha + 'T12:00:00-05:00').getTime() / 1000);
  if (contacto) {
    lead._embedded.contacts = [{ id: contacto.id }];
  } else {
    lead._embedded.contacts = [{ name: f.nombre || f.correo, custom_fields_values: [
      ...(f.correo ? [campo('EMAIL', f.correo, 'WORK')] : []),
      ...(f.telefono ? [campo('PHONE', f.telefono, 'WORK')] : []),
      ...(f.cargo ? [campo('POSITION', f.cargo)] : []),
    ] }];
    if (f.empresa) lead._embedded.companies = [{ name: f.empresa, custom_fields_values: f.dominio ? [campo('WEB', f.dominio)] : [] }];
  }
  return { json: { ...base, accion: 'creado', contacto_id: contacto ? contacto.id : null, metodo: 'POST', url: `${BASE}/leads/complex`, cuerpo: [lead] } };
});

// == Nota en Kommo (armar) (Code, una vez para todos los elementos)
// Saca el id de la oportunidad (la creada o la que ya existía) y arma la nota.
const BASE = 'https://wiptool.kommo.com/api/v4';
const armados = $('__ARMAR__').all();
const respuestas = $input.all();
const cuerpo = (r) => {
  const j = (r && r.json) || {};
  if (typeof j.data !== 'string') return j;
  try { return JSON.parse(j.data); } catch (e) { return {}; }
};
return armados.map((a, i) => {
  const x = a.json;
  let leadId = x.kommo_lead_id, contactoId = x.contacto_id;
  if (x.accion === 'creado') {
    const c = cuerpo(respuestas[i]);
    const r = Array.isArray(c) ? c[0] || {} : c;
    if (!r.id) throw new Error('Kommo no devolvió la oportunidad creada para ' + x.clave + ': ' + JSON.stringify(c).slice(0, 300));
    leadId = r.id; contactoId = r.contact_id || contactoId;
  }
  const extra = { existente: '(la persona ya estaba en Kommo)', movida: '(ya estaba en Kommo: pasó a Reunión agendada)' }[x.accion];
  return { json: {
    url: `${BASE}/leads/notes`, cuerpo: [{ entity_id: leadId, note_type: 'common', params: { text: x.datos.nota + (extra ? '\n' + extra : '') } }],
    fila: { clave: x.clave, kommo_lead_id: leadId, kommo_contacto_id: contactoId, accion: x.accion },
  } };
});
