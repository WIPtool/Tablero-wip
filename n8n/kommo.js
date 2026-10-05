// n8n · F12 · código de los nodos de Kommo. armar-flujo.cjs toma cada parte por su marca "// ==".
// Cada hora: etapas, oportunidades (todas) y cambios de etapa de los últimos 3 días. A mano: cambios del último año.

// == Trabajos Kommo (Code, una vez para todos los elementos)
const BASE = 'https://wiptool.kommo.com/api/v4';
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const manual = !$input.first().json.timestamp;
const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const desde = sumar(hoy, manual ? -364 : -2);
const unix = Math.floor(new Date(desde + 'T00:00:00-05:00').getTime() / 1000); // medianoche de Bogotá
const PAG_LEADS = 4, PAG_EVENTOS = manual ? 20 : 3; // 250 oportunidades y 100 cambios por página
// Los chats sin aceptar (etapa "Leads entrantes") no salen en /leads: hay que pedirlos por la etapa.
const EMBUDO = 14551307, ETAPA_ENTRANTES = 112413247;

return [
  { json: { tipo: 'etapas', url: `${BASE}/leads/pipelines` } },
  { json: { tipo: 'usuarios', url: `${BASE}/users?limit=250` } },
  { json: { tipo: 'entrantes', url: `${BASE}/leads?limit=250&with=loss_reason&filter[statuses][0][pipeline_id]=${EMBUDO}&filter[statuses][0][status_id]=${ETAPA_ENTRANTES}` } },
  ...Array.from({ length: PAG_LEADS }, (_, i) => ({ json: { tipo: 'leads', pagina: i + 1, ultima: i === PAG_LEADS - 1,
    url: `${BASE}/leads?limit=250&page=${i + 1}&with=loss_reason` } })),
  ...Array.from({ length: PAG_EVENTOS }, (_, i) => ({ json: { tipo: 'eventos', pagina: i + 1, ultima: i === PAG_EVENTOS - 1, desde, hasta: hoy,
    url: `${BASE}/events?limit=100&page=${i + 1}&filter[type]=lead_status_changed&filter[created_at][from]=${unix}` } })),
];

// == Filas Kommo (Code, una vez para todos los elementos)
// Junta las páginas y arma tres cargas: etapas, oportunidades y cambios de etapa.
const trabajos = $('Trabajos Kommo').all();
const respuestas = $input.all();
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
const fecha = (s) => (s ? dia.format(new Date(s * 1000)) : null);
const iso = (s) => (s ? new Date(s * 1000).toISOString() : null);
// Kommo responde application/hal+json y n8n lo deja como texto en "data"; las páginas vacías llegan sin cuerpo (204).
const cuerpo = (r) => {
  const j = r.json || {};
  if (typeof j.data !== 'string') return j;
  try { return JSON.parse(j.data); } catch (e) { return {}; }
};
const campo = (lead, prueba) => {
  const f = (lead.custom_fields_values || []).find(prueba);
  return f && f.values && f.values[0] ? String(f.values[0].value ?? '') : '';
};

const etapas = [], usuarios = {}, leads = new Map(), eventos = new Map();
let rango = null;
respuestas.forEach((r, i) => {
  const t = trabajos[i].json;
  const e = cuerpo(r)._embedded || {};
  if (t.tipo === 'etapas') {
    for (const p of e.pipelines || []) {
      for (const s of (p._embedded && p._embedded.statuses) || []) {
        etapas.push({ etapa_id: s.id, embudo_id: p.id, nombre: s.name, orden: s.sort,
          tipo: s.id === 142 ? 'ganada' : s.id === 143 ? 'perdida' : s.type === 1 ? 'entrantes' : 'abierta' });
      }
    }
  } else if (t.tipo === 'usuarios') {
    for (const u of e.users || []) usuarios[u.id] = u.name;
  } else if (t.tipo === 'entrantes') {
    const lista = e.leads || [];
    if (lista.length >= 250) throw new Error('Hay más de 250 chats en Leads entrantes: hay que paginar el trabajo "entrantes" en "Trabajos Kommo"');
    for (const l of lista) leads.set(l.id, l);
  } else if (t.tipo === 'leads') {
    const lista = e.leads || [];
    if (t.ultima && lista.length >= 250) throw new Error('Kommo tiene más de 1.000 oportunidades: hay que subir PAG_LEADS en "Trabajos Kommo"');
    for (const l of lista) leads.set(l.id, l);
  } else {
    rango = { desde: t.desde, hasta: t.hasta };
    const lista = e.events || [];
    if (t.ultima && lista.length >= 100) throw new Error('Hay más cambios de etapa de los que se piden: hay que subir PAG_EVENTOS en "Trabajos Kommo"');
    for (const ev of lista) eventos.set(ev.id, ev);
  }
});

const filasLeads = [...leads.values()].map((l) => {
  const motivo = l._embedded && l._embedded.loss_reason;
  return {
    fecha: fecha(l.created_at), lead_id: l.id, nombre: l.name || '', embudo_id: l.pipeline_id, etapa_id: l.status_id, valor: Number(l.price) || 0,
    origen: campo(l, (f) => f.field_name === 'Origen'), campana: campo(l, (f) => f.field_name === 'Campaña'),
    utm_source: campo(l, (f) => f.field_code === 'UTM_SOURCE'), utm_campaign: campo(l, (f) => f.field_code === 'UTM_CAMPAIGN'),
    responsable: usuarios[l.responsible_user_id] || '', motivo_perdida: Array.isArray(motivo) ? (motivo[0] && motivo[0].name) || '' : (motivo && motivo.name) || '',
    creado: iso(l.created_at), actualizado: iso(l.updated_at), cerrado: iso(l.closed_at),
  };
});

const estado = (v) => { const x = (v || [])[0]; return x && x.lead_status ? x.lead_status.id : null; };
const filasEventos = [...eventos.values()].map((ev) => ({
  fecha: fecha(ev.created_at), evento_id: String(ev.id), lead_id: ev.entity_id, de_etapa: estado(ev.value_before), a_etapa: estado(ev.value_after),
  momento: iso(ev.created_at),
})).filter((f) => f.a_etapa && rango && f.fecha >= rango.desde && f.fecha <= rango.hasta);

const hoy = dia.format(new Date());
const salida = [
  { json: { p_tabla: 'kommo_etapa', p_desde: hoy, p_hasta: hoy, p_filas: etapas, p_fuente: null, p_sitio: null } },
  { json: { p_tabla: 'kommo_lead', p_desde: hoy, p_hasta: hoy, p_filas: filasLeads, p_fuente: 'kommo', p_sitio: null } },
];
if (rango) salida.push({ json: { p_tabla: 'kommo_cambio_etapa', p_desde: rango.desde, p_hasta: rango.hasta, p_filas: filasEventos, p_fuente: 'kommo', p_sitio: null } });
return salida;
