// Periodo del tablero. Vive en la dirección (?p=28, ?p=otro&desde=…&hasta=…) para poder compartir enlaces.
// Como Data Studio: por defecto los últimos 28 días sin contar hoy (hoy está incompleto). Fechas de Bogotá.
import { fechaLarga } from './formato';

export type Preset = '7' | '28' | '90' | 'mes' | 'mes_ant' | 'otro';
export interface Rango { preset: Preset; desde: string; hasta: string }
export type ParametrosBusqueda = Record<string, string | string[] | undefined>;

export const PRESETS: { id: Preset; etiqueta: string }[] = [
  { id: '7', etiqueta: '7 días' },
  { id: '28', etiqueta: '28 días' },
  { id: '90', etiqueta: '90 días' },
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
  switch (preset) {
    case '7': return { desde: sumarDias(hoy, -7), hasta: ayer };
    case '90': return { desde: sumarDias(hoy, -90), hasta: ayer };
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
export function anterior({ desde, hasta }: { desde: string; hasta: string }) {
  const n = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) };
}

export const describir = (r: { desde: string; hasta: string }) => `${fechaLarga(r.desde)} – ${fechaLarga(r.hasta)}`;

// Parámetros de la dirección que conservan el periodo al cambiar de página.
export function consultaPeriodo(r: Rango) {
  if (r.preset === '28') return '';
  if (r.preset === 'otro') return `?p=otro&desde=${r.desde}&hasta=${r.hasta}`;
  return `?p=${r.preset}`;
}
