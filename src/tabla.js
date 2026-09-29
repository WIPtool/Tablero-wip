// Tabla ordenable. La primera columna numérica marcada con barra:true lleva una barra de proporción detrás del valor.
import { num, pct, pos, esc } from './formato.js';

const FORMATOS = { numero: num, pct, pos, texto: (v) => esc(v) };

/**
 * @param {HTMLElement} caja
 * @param {{columnas: Array<{campo:string, etiqueta:string, tipo?:'texto'|'numero'|'pct'|'pos', barra?:boolean, formato?:Function}>,
 *          filas: Array<object>, orden?: string, limite?: number, total?: boolean, vacio?: string}} cfg
 */
export function tabla(caja, cfg) {
  const { columnas, filas } = cfg;
  let orden = cfg.orden || columnas.find((c) => c.tipo && c.tipo !== 'texto')?.campo || columnas[0].campo;
  let asc = false;
  let todo = false;
  const limite = cfg.limite ?? 10;

  const pintar = () => {
    const col = columnas.find((c) => c.campo === orden);
    const ordenadas = [...filas].sort((a, b) => {
      const x = a[orden], y = b[orden];
      const r = col.tipo === 'texto' || !col.tipo ? String(x).localeCompare(String(y), 'es') : (x ?? -Infinity) - (y ?? -Infinity);
      return asc ? r : -r;
    });
    const visibles = todo ? ordenadas : ordenadas.slice(0, limite);
    const barra = columnas.find((c) => c.barra);
    const maxBarra = barra ? Math.max(1, ...filas.map((f) => f[barra.campo] || 0)) : 1;
    const esNum = (c) => c.tipo && c.tipo !== 'texto';

    const cabeza = columnas.map((c) => {
      const activo = c.campo === orden;
      const flecha = activo ? (asc ? ' ↑' : ' ↓') : '';
      return `<th class="${esNum(c) ? 'n' : ''}" ${activo ? `aria-sort="${asc ? 'ascending' : 'descending'}"` : ''}>` +
        `<button type="button" data-campo="${c.campo}">${esc(c.etiqueta)}${flecha}</button></th>`;
    }).join('');

    const cuerpo = visibles.length ? visibles.map((f) => '<tr>' + columnas.map((c) => {
      const v = f[c.campo];
      const txt = (c.formato || FORMATOS[c.tipo || 'texto'])(v, f);
      if (c.barra) {
        const w = Math.round(((v || 0) / maxBarra) * 100);
        return `<td class="n barra"><div class="relleno" style="width:calc(${w}% - 16px)"></div><span>${txt}</span></td>`;
      }
      return `<td class="${esNum(c) ? 'n' : 'txt'}">${txt}</td>`;
    }).join('') + '</tr>').join('')
      : `<tr><td class="vacio" colspan="${columnas.length}">${esc(cfg.vacio || 'Sin datos en este periodo.')}</td></tr>`;

    let pie = '';
    if (cfg.total && filas.length > 1) {
      pie = '<tfoot><tr>' + columnas.map((c, i) => {
        if (i === 0) return '<td>Total</td>';
        if (c.tipo === 'numero') return `<td class="n">${num(filas.reduce((a, f) => a + (f[c.campo] || 0), 0))}</td>`;
        return '<td></td>';
      }).join('') + '</tr></tfoot>';
    }

    caja.innerHTML = `<div class="tabla-caja"><table class="tabla"><thead><tr>${cabeza}</tr></thead><tbody>${cuerpo}</tbody>${pie}</table></div>` +
      (filas.length > limite ? `<button type="button" class="mas">${todo ? 'Ver menos' : `Ver las ${filas.length}`}</button>` : '');

    caja.querySelectorAll('th button').forEach((b) => b.addEventListener('click', () => {
      const campo = b.dataset.campo;
      if (campo === orden) asc = !asc;
      else { orden = campo; asc = !esNum(columnas.find((c) => c.campo === campo)); }
      pintar();
    }));
    caja.querySelector('.mas')?.addEventListener('click', () => { todo = !todo; pintar(); });
  };
  pintar();
}
