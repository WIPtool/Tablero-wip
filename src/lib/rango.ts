// Periodo del tablero. Vive en la dirección (?p=28, ?p=otro&desde=…&hasta=…) para poder compartir enlaces.
// Como Data Studio: por defecto los últimos 28 días sin contar hoy (hoy está incompleto). Fechas de Bogotá.
// "Hoy" muestra el día en curso hasta la última carga (Kommo, el agente y Meta se cargan cada hora; Google llega con retraso).
import { fechaLarga } from './formato';

export type Preset = 'hoy' | '7' | '28' | '90' | 'semana' | 'semana_ant' | 'mes' | 'mes_ant' | 'otro';
export interface Rango { preset: Preset; desde: string; hasta: string }
export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

export const PRESETS: { id: Preset; etiqueta: string }[] = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: '7', etiqueta: '7 días' },
  { id: '28', etiqueta: '28 días' },
  { id: '90', etiqueta: '90 días' },
  { id: 'semana', etiqueta: 'Esta semana' },
  { id: 'semana_ant', etiqueta: 'Semana anterior' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mes_ant', etiqueta: 'Mes anterior' },
  { id: 'otro', etiqueta: 'Otro' },
];

export const hoyBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export function sumarDias(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000) + 1;

const esFecha = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function calcular(preset: Preset, desde?: string, hasta?: string): { desde: string; hasta: string } {
  const hoy = hoyBogota();
  const ayer = sumarDias(hoy, -1);
  const primeroDelMes = hoy.slice(0, 8) + '01';
  // Las semanas van de lunes a domingo.
  const lunes = sumarDias(hoy, -((new Date(hoy + 'T00:00:00Z').getUTCDay() + 6) % 7));
  switch (preset) {
    case 'hoy': return { desde: hoy, hasta: hoy };
    case '7': return { desde: sumarDias(hoy, -7), hasta: ayer };
    case '90': return { desde: sumarDias(hoy, -90), hasta: ayer };
    case 'semana': return { desde: lunes, hasta: hoy === lunes ? hoy : ayer };
    case 'semana_ant': return { desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -1) };
    case 'mes': return { desde: primeroDelMes, hasta: hoy === primeroDelMes ? hoy : ayer };
    case 'mes_ant': {
      const fin = sumarDias(primeroDelMes, -1);
      return { desde: fin.slice(0, 8) + '01', hasta: fin };
    }
    case 'otro':
      if (esFecha(desde) && esFecha(hasta) && desde <= hasta) return { desde, hasta };
      return { desde: sumarDias(hoy, -28), hasta: ayer };
    default: return { desde: sumarDias(hoy, -28), hasta: ayer };
  }
}

export function leerRango(sp: ParametrosBusqueda): Rango {
  const p = typeof sp.p === 'string' && PRESETS.some((x) => x.id === sp.p) ? (sp.p as Preset) : '28';
  const d = typeof sp.desde === 'string' ? sp.desde : undefined;
  const h = typeof sp.hasta === 'string' ? sp.hasta : undefined;
  return { preset: p, ...calcular(p, d, h) };
}

// El periodo anterior tiene la misma duración y termina el día antes del actual (igual que las funciones SQL).
// "Esta semana" se compara con los mismos días de la semana pasada (de lunes al mismo día).
export function anterior({ desde, hasta, preset }: { desde: string; hasta: string; preset?: Preset }) {
  if (preset === 'semana') return { desde: sumarDias(desde, -7), hasta: sumarDias(hasta, -7) };
  const n = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) };
}

// Parámetros de periodo para las funciones de Supabase: p_comparar solo cuando la comparación no es con los días inmediatamente anteriores.
export function paramsPeriodo(r: Rango): { p_desde: string; p_hasta: string; p_comparar?: string } {
  return r.preset === 'semana' ? { p_desde: r.desde, p_hasta: r.hasta, p_comparar: anterior(r).desde } : { p_desde: r.desde, p_hasta: r.hasta };
}

export const describir = (r: { desde: string; hasta: string }) =>
  r.desde === r.hasta ? fechaLarga(r.desde) : `${fechaLarga(r.desde)} – ${fechaLarga(r.hasta)}`;

// Parámetros de la dirección que conservan el periodo al cambiar de página.
export function consultaPeriodo(r: Rango) {
  if (r.preset === '28') return '';
  if (r.preset === 'otro') return `?p=otro&desde=${r.desde}&hasta=${r.hasta}`;
  return `?p=${r.preset}`;
}
