// n8n · F12 · código de los nodos de Explee. armar-flujo.cjs toma cada parte por su marca "// ==".
// Explee no da histórico por día: cada hora se guarda lo "de hoy" de cada campaña (igual que hacía la hoja "Explee - Tablero").

// == Trabajos Explee (Code, una vez para todos los elementos)
return [{ json: { url: 'https://api.explee.com/public/api/v1/autogtm/campaigns' } }];

// == Pedidos Explee (Code, una vez para todos los elementos)
// Con la lista de campañas arma los pedidos: la analítica de hoy de cada campaña y las páginas de leads calientes.
const BASE = 'https://api.explee.com/public/api/v1/autogtm';
const campanas = $input.first().json.campaigns || [];
return [
  ...campanas.map((c) => ({ json: { tipo: 'analitica', campana_id: String(c.id), campana: c.name || '',
    url: `${BASE}/campaigns/${c.id}/analytics?period=today` } })),
  ...[0, 100, 200, 300, 400].map((offset) => ({ json: { tipo: 'leads', url: `${BASE}/hot-leads?limit=100&offset=${offset}` } })),
];

// == Filas Explee (Code, una vez para todos los elementos)
// Junta las respuestas: una fila por campaña con lo de hoy, y la lista completa de leads calientes.
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
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
const diario = [];
const leads = new Map();
respuestas.forEach((r, i) => {
  const p = pedidos[i].json;
  if (p.tipo === 'analitica') {
    nombres[p.campana_id] = p.campana;
    const a = r.json;
    diario.push({ fecha: hoy, campana_id: p.campana_id, campana: p.campana, enviados: num(a.emails_sent), respuestas: num(a.total_replies),
      leads: num(a.hot_leads), gasto_usd: num(a.spend_usd) });
  } else {
    for (const l of r.json.leads || []) leads.set(String(l.id ?? `${l.email}|${l.company_domain}`), l);
  }
});

const filasLeads = [...leads.entries()].map(([id, l]) => ({
  fecha: l.became_hot_at ? dia.format(new Date(l.became_hot_at)) : null, lead_id: id,
  campana: nombres[l.campaign_id] || String(l.campaign_id || ''), empresa: l.company_name || '', dominio: l.company_domain || '',
  cargo: l.job_title || '', pais: l.country || '', motivo: propio(l.why_hot), nombre: l.name || '', correo: l.email || '',
  linkedin: l.linkedin_url || '', telefono: l.phone || '', nota: l.note || '',
}));

return [
  { json: { p_tabla: 'explee_campana_diario', p_desde: hoy, p_hasta: hoy, p_filas: diario, p_fuente: 'explee', p_sitio: null } },
  { json: { p_tabla: 'explee_lead', p_desde: hoy, p_hasta: hoy, p_filas: filasLeads, p_fuente: 'explee', p_sitio: null } },
];
