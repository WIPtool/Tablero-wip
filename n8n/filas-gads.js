// n8n · F14 · nodo "Filas Google Ads" (Code, una vez para todos los elementos).
// Revisa lo que envía el script de Google Ads y arma la llamada a cargar() de Supabase.
const b = $input.first().json.body || {};
const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
if (!esFecha(b.desde) || !esFecha(b.hasta) || !Array.isArray(b.filas)) throw new Error('Envío de Google Ads con formato inesperado');

const moneda = String(b.moneda || 'COP').toUpperCase().slice(0, 3);
const m = new Map();
for (const f of b.filas) {
  if (!esFecha(f.fecha) || f.fecha < b.desde || f.fecha > b.hasta) continue;
  const clave = f.fecha + '|' + f.campana_id;
  const a = m.get(clave) || { fecha: f.fecha, campana_id: String(f.campana_id), campana: String(f.campana || '').slice(0, 200), moneda,
    inversion: 0, impresiones: 0, clics: 0, conversiones: 0 };
  a.inversion += Number(f.inversion) || 0;
  a.impresiones += Math.round(Number(f.impresiones) || 0);
  a.clics += Math.round(Number(f.clics) || 0);
  a.conversiones += Number(f.conversiones) || 0;
  m.set(clave, a);
}
return [{ json: { p_tabla: 'gads_campana_diario', p_desde: b.desde, p_hasta: b.hasta, p_filas: [...m.values()], p_fuente: 'gads', p_sitio: null } }];
