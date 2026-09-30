// n8n · F12 · nodo "Trabajos TRM" (Code, una vez para todos los elementos).
// TRM oficial de datos.gov.co (no pide clave). A las 7 a. m. carga los últimos 10 días; a mano, desde 2024.
const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
const manual = !$input.first().json.timestamp;
if (!manual && hora !== 7) return [];

const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const desde = manual ? '2024-01-01' : sumar(hoy, -10);
const donde = encodeURIComponent(`vigenciahasta >= '${desde}T00:00:00'`);
return [{ json: { fuente: 'trm', tabla: 'trm_diaria', desde, hasta: hoy, sitio: null,
  url: `https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde&$limit=5000&$where=${donde}` } }];
