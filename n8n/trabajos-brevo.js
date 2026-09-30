// n8n · F12 · nodo "Trabajos Brevo" (Code, una vez para todos los elementos).
// Cada hora: correos de las automatizaciones de los últimos 3 días y todas las campañas masivas enviadas.
// Corrido a mano: correos de los últimos 90 días, por tramos de 5 días.
// Los eventos se piden con un día de margen a cada lado (Brevo no usa la hora de Bogotá) y luego se recortan.
const BASE = 'https://api.brevo.com/v3';
const LIMITE = 2500; // si un tramo llega a este número, "Filas Brevo" avisa con un error para partirlo más

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const manual = !$input.first().json.timestamp;
const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tramos = (desde, hasta, dias) => {
  const out = [];
  for (let a = desde; a <= hasta; a = sumar(a, dias)) { const b = sumar(a, dias - 1); out.push([a, b < hasta ? b : hasta]); }
  return out;
};

const eventos = (manual ? tramos(sumar(hoy, -89), hoy, 5) : [[sumar(hoy, -2), hoy]]).map(([desde, hasta]) => ({ json: {
  fuente: 'brevo', tabla: 'brevo_evento_diario', desde, hasta, sitio: null, limite: LIMITE,
  url: `${BASE}/smtp/statistics/events?limit=${LIMITE}&offset=0&sort=desc&startDate=${sumar(desde, -1)}&endDate=${sumar(hasta, 1) > hoy ? hoy : sumar(hasta, 1)}`,
} }));

const campanas = { json: {
  fuente: 'brevo', tabla: 'brevo_campana', desde: '2000-01-01', hasta: '2100-12-31', sitio: null,
  url: `${BASE}/emailCampaigns?type=classic&status=sent&statistics=globalStats&excludeHtmlContent=true&limit=100&offset=0`,
} };

return [...eventos, campanas];
