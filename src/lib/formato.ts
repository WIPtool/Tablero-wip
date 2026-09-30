// Formatos en español de Colombia: 1.234 · 3,2 % · 28 sept.
const entero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const diaMes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const diaMesAno = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const diaSemana = new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

type Numero = number | null | undefined;
export const num = (v: Numero) => (v == null || Number.isNaN(v) ? '—' : entero.format(v));
export const pct = (v: Numero) => (v == null || !Number.isFinite(v) ? '—' : decimal1.format(v * 100) + ' %');
export const pesos = (v: Numero) => (v == null || Number.isNaN(v) ? '—' : '$ ' + entero.format(v));
export const pos = (v: Numero) => (v == null || !Number.isFinite(v) ? '—' : decimal1.format(v));

const aFecha = (iso: string) => new Date(iso + 'T00:00:00Z');
export const fechaCorta = (iso: string) => diaMes.format(aFecha(iso)).replace('.', '');
export const fechaLarga = (iso: string) => diaMesAno.format(aFecha(iso)).replace('.', '');
export const fechaConDia = (iso: string) => diaSemana.format(aFecha(iso)).replace(/\./g, '');

export type Cambio = { texto: string; clase: '' | 'sube' | 'baja' } | null;

// Cambio contra el periodo anterior. menorEsMejor: para la posición en Google (1 es lo mejor).
export function cambio(actual: Numero, anterior: Numero, { menorEsMejor = false } = {}): Cambio {
  if (actual == null || anterior == null) return null;
  if (anterior === 0) return actual === 0 ? { texto: 'sin cambio', clase: '' } : { texto: 'nuevo', clase: menorEsMejor ? '' : 'sube' };
  const d = (actual - anterior) / Math.abs(anterior);
  if (Math.abs(d) < 0.005) return { texto: 'sin cambio', clase: '' };
  // Más de 10 veces: el periodo anterior casi no tiene datos (p. ej., antes de que empezara la medición).
  if (d > 10) return { texto: 'el periodo anterior casi no tiene datos', clase: '' };
  const mejora = menorEsMejor ? d < 0 : d > 0;
  return { texto: (d > 0 ? '▲ ' : '▼ ') + decimal1.format(Math.abs(d) * 100) + ' %', clase: mejora ? 'sube' : 'baja' };
}

export function haceCuanto(isoFechaHora: string) {
  const min = Math.round((Date.now() - new Date(isoFechaHora).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export const horasDesde = (isoFechaHora: string) => (Date.now() - new Date(isoFechaHora).getTime()) / 3600000;
