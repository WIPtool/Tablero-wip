// n8n · F12 · nodo "Trabajos Meta" (Code, una vez para todos los elementos).
// Cada hora: Meta Ads de los últimos 3 días (Meta ajusta las cifras durante unas horas).
// Corrido a mano: histórico desde 2025-01-01, por tramos de 31 días.
const CUENTA = 'act_1212455492189816';
const INICIO = '2025-01-01';

const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const manual = !$input.first().json.timestamp;
const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const tramos = (desde, hasta, dias) => {
  const out = [];
  for (let a = desde; a <= hasta; a = sumar(a, dias)) { const b = sumar(a, dias - 1); out.push([a, b < hasta ? b : hasta]); }
  return out;
};

return (manual ? tramos(INICIO, hoy, 31) : [[sumar(hoy, -2), hoy]]).map(([desde, hasta]) => {
  // El Code de n8n no tiene URLSearchParams: se arma a mano.
  const qs = Object.entries({
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since: desde, until: hasta }),
    fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,account_currency',
    limit: '1000',
  }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return { json: { fuente: 'meta', tabla: 'meta_campana_diario', desde, hasta, sitio: null,
    url: `https://graph.facebook.com/v23.0/${CUENTA}/insights?${qs}` } };
});
