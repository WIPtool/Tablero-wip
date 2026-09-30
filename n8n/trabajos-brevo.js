// n8n · F12 · nodo "Trabajos Brevo" (Code, una vez para todos los elementos).
// Cada hora: correos de las automatizaciones de los últimos 3 días y todas las campañas masivas enviadas.
// Corrido a mano: correos de los últimos 90 días.
// Los eventos se piden día por día (con un día de margen a cada lado, porque Brevo no usa la hora de Bogotá)
// y en páginas de LIMITE; "Filas Brevo" los junta y guarda solo los días del rango.
const BASE = 'https://api.brevo.com/v3';
const LIMITE = 2500;
const PAGINAS = 3; // hasta 7.500 eventos por día; si la última página llega llena, "Filas Brevo" avisa con un error

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const manual = !$input.first().json.timestamp;
const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const desde = sumar(hoy, manual ? -89 : -2);
const eventos = [];
for (let dia = sumar(desde, -1); dia <= hoy; dia = sumar(dia, 1)) {
  for (let p = 0; p < PAGINAS; p++) {
    eventos.push({ json: {
      fuente: 'brevo', tabla: 'brevo_evento_diario', desde, hasta: hoy, sitio: null, dia, pagina: p, ultima: p === PAGINAS - 1, limite: LIMITE,
      url: `${BASE}/smtp/statistics/events?limit=${LIMITE}&offset=${p * LIMITE}&sort=desc&startDate=${dia}&endDate=${dia}`,
    } });
  }
}

const campanas = { json: {
  fuente: 'brevo', tabla: 'brevo_campana', desde: '2000-01-01', hasta: '2100-12-31', sitio: null,
  url: `${BASE}/emailCampaigns?type=classic&status=sent&statistics=globalStats&excludeHtmlContent=true&limit=100&offset=0`,
} };

return [...eventos, campanas];
