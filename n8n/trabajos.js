// n8n · F12 · nodo "Trabajos" (Code, una vez para todos los elementos).
// Arma la lista de consultas a Google que luego se guardan en Supabase.
//  - Cada hora: Google Analytics de los últimos 3 días (los datos de GA4 se ajustan durante ~48 h).
//  - A las 7 a. m. de Bogotá: además, Search Console de los últimos 6 días (Google publica con 2-3 días de retraso).
//  - Corrido a mano: histórico completo por tramos de 31 días (GA4 desde 2024-01-01, Search Console 16 meses).
const PROPIEDAD_GA4 = '333145660';
const SITIO_GSC = 'sc-domain:wiptool.com';
const INICIO_GA4 = '2024-01-01';

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
const manual = !$input.first().json.timestamp; // el disparador de cada hora trae "timestamp"; el manual no

const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tramos = (desde, hasta, dias) => {
  const out = [];
  for (let a = desde; a <= hasta; a = sumar(a, dias)) { const b = sumar(a, dias - 1); out.push([a, b < hasta ? b : hasta]); }
  return out;
};

const GA4 = {
  ga4_canal_diario: {
    dimensions: ['date', 'sessionDefaultChannelGroup', 'sessionSource', 'sessionMedium', 'sessionCampaignName', 'sessionManualAdContent', 'sessionManualTerm'],
    metrics: ['sessions', 'keyEvents'],
  },
  ga4_evento_diario: { dimensions: ['date', 'eventName', 'customEvent:origen', 'customEvent:correo'], metrics: ['eventCount', 'keyEvents', 'totalUsers'] },
  ga4_pagina_diario: { dimensions: ['date', 'landingPage'], metrics: ['sessions', 'keyEvents'] },
  ga4_audiencia_diario: { dimensions: ['date', 'countryId', 'deviceCategory'], metrics: ['sessions', 'keyEvents'] },
};

const trabajos = [];
for (const [desde, hasta] of manual ? tramos(INICIO_GA4, hoy, 31) : [[sumar(hoy, -2), hoy]]) {
  for (const [tabla, r] of Object.entries(GA4)) {
    trabajos.push({
      fuente: 'ga4', tabla, desde, hasta, sitio: null,
      url: `https://analyticsdata.googleapis.com/v1beta/properties/${PROPIEDAD_GA4}:runReport`,
      body: {
        dateRanges: [{ startDate: desde, endDate: hasta }],
        dimensions: r.dimensions.map((name) => ({ name })),
        metrics: r.metrics.map((name) => ({ name })),
        limit: 250000,
      },
    });
  }
}

if (manual || hora === 7) {
  // Un mismo dominio en Search Console: se separa por el host de la página.
  const SITIOS = { 'wiptool.com': 'notContains', 'platform.wiptool.com': 'contains' };
  const TABLAS = { gsc_pagina_diario: ['date', 'page'], gsc_consulta_diario: ['date', 'query'] };
  for (const [desde, hasta] of manual ? tramos(sumar(hoy, -486), sumar(hoy, -1), 31) : [[sumar(hoy, -6), sumar(hoy, -1)]]) {
    for (const [sitio, operador] of Object.entries(SITIOS)) {
      for (const [tabla, dimensions] of Object.entries(TABLAS)) {
        trabajos.push({
          fuente: 'gsc', tabla, desde, hasta, sitio,
          url: `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITIO_GSC)}/searchAnalytics/query`,
          body: {
            startDate: desde, endDate: hasta, dimensions, rowLimit: 25000, dataState: 'all',
            dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: operador, expression: 'platform.wiptool.com' }] }],
          },
        });
      }
    }
  }
}

return trabajos.map((json) => ({ json }));
