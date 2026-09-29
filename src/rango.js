// Periodo del tablero. Como Data Studio: por defecto los últimos 28 días sin contar hoy (hoy está incompleto).
// Las fechas son de Bogotá y se manejan como texto AAAA-MM-DD.
import { fechaLarga } from './formato.js';

export const PRESETS = [
  { id: '7', etiqueta: '7 días' },
  { id: '28', etiqueta: '28 días' },
  { id: '90', etiqueta: '90 días' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'mes_ant', etiqueta: 'Mes anterior' },
  { id: 'otro', etiqueta: 'Otro' },
];

export function hoyBogota() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}
export function sumarDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const diasEntre = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000) + 1;

export function calcular(preset, desde, hasta) {
  const hoy = hoyBogota();
  const ayer = sumarDias(hoy, -1);
  switch (preset) {
    case '7': return { desde: sumarDias(hoy, -7), hasta: ayer };
    case '90': return { desde: sumarDias(hoy, -90), hasta: ayer };
    case 'mes': return { desde: hoy.slice(0, 8) + '01', hasta: hoy === hoy.slice(0, 8) + '01' ? hoy : ayer };
    case 'mes_ant': {
      const fin = sumarDias(hoy.slice(0, 8) + '01', -1);
      return { desde: fin.slice(0, 8) + '01', hasta: fin };
    }
    case 'otro': return desde && hasta && desde <= hasta ? { desde, hasta } : { desde: sumarDias(hoy, -28), hasta: ayer };
    default: return { desde: sumarDias(hoy, -28), hasta: ayer };
  }
}

// El periodo anterior tiene la misma duración y termina el día antes del actual (igual que las funciones SQL).
export function anterior({ desde, hasta }) {
  const n = diasEntre(desde, hasta);
  return { desde: sumarDias(desde, -n), hasta: sumarDias(desde, -1) };
}

export const describir = (r) => `${fechaLarga(r.desde)} – ${fechaLarga(r.hasta)}`;

const CLAVE = 'tablero_periodo';
export function leerGuardado() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && PRESETS.some((p) => p.id === g.preset)) return g;
  } catch (e) { /* sin almacenamiento: se usa el predeterminado */ }
  return { preset: '28' };
}
export function guardar(estado) {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* no pasa nada */ }
}
