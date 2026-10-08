// n8n · F12 · F4 Explee → Kommo. armar-flujo.cjs toma cada parte por su marca "// ==".
// Cada hora, después de leer Explee: los leads calientes que aún no pasaron a Kommo se crean como oportunidad en el embudo
// "Prospección (Explee)", etapa "Respondió en Explee"
// (Origen = Explee, Campaña = la de Explee, con contacto, empresa y una nota con lo que respondió la persona).
// Si la persona ya está en Kommo (mismo correo o teléfono) no se duplica: solo se le deja la nota en su última oportunidad.
// La tabla explee_kommo de Supabase guarda qué leads de Explee ya pasaron; la vista explee_pendientes_kommo da los que faltan.

// == Nuevos para Kommo (Code, una vez para todos los elementos)
const LIMITE = 0; // 0 = todos; para una prueba se pone un número
const BASE = 'https://wiptool.kommo.com/api/v4';
const digitos = (t) => String(t || '').replace(/\D/g, '').slice(-10);
// "Pendientes para Kommo" devuelve una fila por lead pendiente (o un elemento vacío si no hay ninguno).
let nuevos = $input.all().map((i) => i.json).filter((f) => f.lead_id && (f.correo || digitos(f.telefono)));
if (LIMITE) nuevos = nuevos.slice(0, LIMITE);
const buscar = (q) => `${BASE}/contacts?with=leads&query=${encodeURIComponent(q)}`;
return nuevos.map((f) => ({ json: { ...f,
  url_correo: buscar(f.correo || digitos(f.telefono)),
  url_telefono: buscar(digitos(f.telefono) || f.correo) } }));

// == Armar oportunidades (Code, una vez para todos los elementos)
// Con lo que encontró Kommo por correo y por teléfono decide: crear la oportunidad o solo dejar la nota.
const BASE = 'https://wiptool.kommo.com/api/v4';
const EMBUDO = 14590803, ETAPA_NUEVO = 112730835, CAMPO_ORIGEN = 421634, ORIGEN_EXPLEE = 340200, CAMPO_CAMPANA = 421636;
const nuevos = $('Nuevos para Kommo').all();
const porCorreo = $('Buscar correo en Kommo').all();
const porTelefono = $input.all();
const cuerpo = (r) => {
  const j = (r && r.json) || {};
  if (typeof j.data !== 'string') return j;
  try { return JSON.parse(j.data); } catch (e) { return {}; }
};
const contactos = (r) => (cuerpo(r)._embedded || {}).contacts || [];
const campo = (code, value, enumCode) => ({ field_code: code, values: [enumCode ? { value, enum_code: enumCode } : { value }] });

return nuevos.map((n, i) => {
  const f = n.json;
  const contacto = [...contactos(porCorreo[i]), ...contactos(porTelefono[i])][0];
  const ultima = contacto && ((contacto._embedded && contacto._embedded.leads) || []).map((l) => l.id).sort((a, b) => b - a)[0];
  const base = { explee_id: f.lead_id, datos: f };
  // Ya está en Kommo: a su última oportunidad solo se le agrega la etiqueta Explee (y luego la nota).
  if (ultima) return { json: { ...base, accion: 'existente', contacto_id: contacto.id, kommo_lead_id: ultima, metodo: 'PATCH', url: `${BASE}/leads`,
    cuerpo: [{ id: ultima, tags_to_add: [{ name: 'Explee' }] }] } };

  const lead = {
    name: f.empresa || f.nombre || f.correo, pipeline_id: EMBUDO, status_id: ETAPA_NUEVO,
    custom_fields_values: [
      { field_id: CAMPO_ORIGEN, values: [{ enum_id: ORIGEN_EXPLEE }] },
      ...(f.campana ? [{ field_id: CAMPO_CAMPANA, values: [{ value: f.campana }] }] : []),
    ],
    _embedded: { tags: [{ name: 'Explee' }] },
  };
  // Fecha real del lead caliente (mediodía de Bogotá), para que el tablero lo cuente el día que respondió.
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

// == Nota de cada uno (Code, una vez para todos los elementos)
// Saca el id de la oportunidad (la creada o la que ya existía) y arma la nota con lo que respondió la persona.
const BASE = 'https://wiptool.kommo.com/api/v4';
const armados = $('Armar oportunidades').all();
const respuestas = $input.all();
const cuerpo = (r) => {
  const j = (r && r.json) || {};
  if (typeof j.data !== 'string') return j;
  try { return JSON.parse(j.data); } catch (e) { return {}; }
};
return armados.map((a, i) => {
  const x = a.json, f = x.datos;
  let leadId = x.kommo_lead_id, contactoId = x.contacto_id;
  if (x.accion === 'creado') {
    const c = cuerpo(respuestas[i]);
    const r = Array.isArray(c) ? c[0] || {} : c;
    if (!r.id) throw new Error('Kommo no devolvió la oportunidad creada para el lead de Explee ' + x.explee_id + ': ' + JSON.stringify(c).slice(0, 300));
    leadId = r.id; contactoId = r.contact_id || contactoId;
  }
  const lineas = [
    'Lead caliente de Explee' + (x.accion === 'existente' ? ' (ya estaba en Kommo)' : ''),
    `Campaña: ${f.campana || '—'} · Fecha: ${f.fecha || '—'}`,
    `Empresa: ${f.empresa || '—'}${f.dominio ? ' (' + f.dominio + ')' : ''}${f.pais ? ' · País: ' + f.pais : ''}`,
    f.cargo ? `Cargo: ${f.cargo}` : '',
    f.linkedin ? `LinkedIn: ${f.linkedin}` : '',
    f.motivo ? `Respondió: "${f.motivo}"` : '',
    f.nota ? `Nota de Explee: ${f.nota}` : '',
  ].filter(Boolean);
  return { json: {
    url: `${BASE}/leads/notes`, cuerpo: [{ entity_id: leadId, note_type: 'common', params: { text: lineas.join('\n') } }],
    fila: { lead_id: x.explee_id, kommo_lead_id: leadId, kommo_contacto_id: contactoId, accion: x.accion },
  } };
});

// == Registro Explee-Kommo (Code, una vez para todos los elementos)
return [{ json: { filas: $('Nota de cada uno').all().map((i) => i.json.fila) } }];
