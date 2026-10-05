// n8n · F12 · código de los nodos de Explee. armar-flujo.cjs toma cada parte por su marca "// ==".
// La API de Explee no da cifras por día: cada hora se guarda el total acumulado de cada campaña (period=all) y Supabase
// calcula lo de cada día en hora de Colombia restando totales (explee_recalcular_diario, 008_explee_por_dia.sql).
// Los leads calientes se piden con since= (los de los últimos 3 días cada hora; todos en la carga a mano) y se acumulan.

// == Trabajos Explee (Code, una vez para todos los elementos)
const manual = !$input.first().json.timestamp;
return [{ json: { url: 'https://api.explee.com/public/api/v1/autogtm/campaigns', manual } }];

// == Pedidos Explee (Code, una vez para todos los elementos)
// Con la lista de campañas arma los pedidos: el total acumulado de cada campaña y los leads calientes recientes.
const BASE = 'https://api.explee.com/public/api/v1/autogtm';
const campanas = $input.first().json.campaigns || [];
const manual = $('Trabajos Explee').first().json.manual;
const desde = manual ? '2020-01-01T00:00:00Z' : new Date(Date.now() - 3 * 86400000).toISOString();
return [
  ...campanas.map((c) => ({ json: { tipo: 'analitica', campana_id: String(c.id), campana: c.name || '',
    url: `${BASE}/campaigns/${c.id}/analytics?period=all` } })),
  { json: { tipo: 'leads', url: `${BASE}/hot-leads?limit=200&since=${encodeURIComponent(desde)}` } },
];

// == Filas Explee (Code, una vez para todos los elementos)
// Junta las respuestas: el total acumulado de cada campaña en este momento y los leads calientes.
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
const ahora = new Date();
const hoy = dia.format(ahora);
const pedidos = $('Pedidos Explee').all();
const respuestas = $input.all();
const num = (v) => (v == null || v === '' ? 0 : Number(v) || 0);

// Deja solo lo que escribió la persona: corta el correo citado ("El ... escribió:", "On ... wrote:", líneas con ">").
const propio = (texto) => {
  const lineas = String(texto || '').split(/\r?\n/);
  const fin = lineas.findIndex((l) => /^\s*>/.test(l) || /^\s*(El|On)\s.+(escribió|wrote):?\s*$/i.test(l) || /^\s*(El|On)\s.+\d{4}/.test(l));
  const t = (fin >= 0 ? lineas.slice(0, fin) : lineas).join(' ').replace(/\s+/g, ' ').trim();
  return t.length > 500 ? t.slice(0, 497) + '...' : t;
};

const nombres = {};
const acumulado = [];
const leads = new Map();
respuestas.forEach((r, i) => {
  const p = pedidos[i].json;
  if (p.tipo === 'analitica') {
    nombres[p.campana_id] = p.campana;
    const a = r.json;
    if (a.emails_sent == null) throw new Error(`Explee no devolvió el total de la campaña ${p.campana}: ${JSON.stringify(a).slice(0, 200)}`);
    acumulado.push({ fecha: hoy, momento: ahora.toISOString(), campana_id: p.campana_id, campana: p.campana,
      enviados: num(a.emails_sent), respuestas: num(a.total_replies), leads: num(a.hot_leads), gasto_usd: num(a.spend_usd) });
  } else {
    const lista = r.json.leads || [];
    if (lista.length >= 200) throw new Error('Explee devolvió 200 leads calientes o más (el máximo por pedido): hay que paginar el pedido de leads en "Pedidos Explee"');
    for (const l of lista) leads.set(`${l.email}|${l.company_domain}`, l);
  }
});

const filasLeads = [...leads.entries()].map(([id, l]) => ({
  fecha: l.became_hot_at ? dia.format(new Date(l.became_hot_at)) : null, lead_id: id,
  campana: nombres[l.campaign_id] || String(l.campaign_id || ''), empresa: l.company_name || '', dominio: l.company_domain || '',
  cargo: l.job_title || '', pais: l.country || '', motivo: propio(l.why_hot), nombre: l.name || '', correo: l.email || '',
  linkedin: l.linkedin_url || '', telefono: l.phone || '', nota: l.note || '',
}));

return [
  { json: { p_tabla: 'explee_acumulado', p_desde: hoy, p_hasta: hoy, p_filas: acumulado, p_fuente: 'explee', p_sitio: null } },
  { json: { p_tabla: 'explee_lead', p_desde: hoy, p_hasta: hoy, p_filas: filasLeads, p_fuente: null, p_sitio: null } },
];
