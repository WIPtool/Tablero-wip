// n8n · F12 · nodo "Filas TRM" (Code, una vez para todos los elementos).
// datos.gov.co devuelve tramos de vigencia (un fin de semana es un solo tramo); aquí se abren en un valor por día.
const t = $('Trabajos TRM').first().json;
const sumar = (f, n) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const porDia = new Map();
for (const { json: x } of $input.all()) {
  if (!x || !x.vigenciadesde) continue;
  const valor = Number(x.valor);
  for (let d = x.vigenciadesde.slice(0, 10); d <= x.vigenciahasta.slice(0, 10); d = sumar(d, 1)) {
    if (d >= t.desde && d <= t.hasta) porDia.set(d, valor);
  }
}
const filas = [...porDia].map(([fecha, valor]) => ({ fecha, valor }));
const fechas = filas.map((f) => f.fecha).sort();
if (!filas.length) return [];
return [{ json: { p_tabla: 'trm_diaria', p_desde: fechas[0], p_hasta: fechas[fechas.length - 1], p_filas: filas, p_fuente: 'trm', p_sitio: null } }];
