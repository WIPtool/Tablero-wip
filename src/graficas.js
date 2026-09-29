// Gráficas en SVG propio, sin librerías: paneles apilados que comparten el eje de fechas
// (nunca dos escalas en un mismo eje). Un cursor recorre todos los paneles y muestra el detalle del día.
import { num, fechaCorta, fechaConDia, esc } from './formato.js';

const NS = 'http://www.w3.org/2000/svg';
const M = { izq: 44, der: 14, arriba: 22, abajo: 26, entre: 34 };

function escalaBonita(max) {
  if (!max || max <= 0) return { tope: 4, paso: 1 };
  const bruto = max / 3;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  let paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  if (paso < 1) paso = 1;
  return { tope: Math.ceil(max / paso) * paso, paso };
}

function el(nombre, attrs = {}, padre) {
  const e = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (padre) padre.appendChild(e);
  return e;
}

// Columna con la punta redondeada (4 px) y la base recta sobre el eje.
function columna(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * @param {HTMLElement} contenedor
 * @param {Array<object>} serie  filas con { fecha, ...campos }
 * @param {Array<{campo:string, etiqueta:string, forma:'linea'|'columnas', color:string}>} paneles
 */
export function graficaPaneles(contenedor, serie, paneles, { alto = 128 } = {}) {
  contenedor.classList.add('grafica');
  let ultimoAncho = 0;
  const dibujar = () => {
    const ancho = Math.max(280, Math.round(contenedor.clientWidth));
    if (ancho === ultimoAncho) return;
    ultimoAncho = ancho;
    contenedor.innerHTML = '';
    if (!serie.length) {
      contenedor.innerHTML = '<p class="nota" style="padding:40px 0;text-align:center">Sin datos en este periodo.</p>';
      return;
    }
    const n = serie.length;
    const altoTotal = M.arriba + paneles.length * alto + (paneles.length - 1) * M.entre + M.abajo;
    const svg = el('svg', { viewBox: `0 0 ${ancho} ${altoTotal}`, tabindex: '0', role: 'img',
      'aria-label': paneles.map((p) => `${p.etiqueta}: ${num(serie.reduce((a, f) => a + (f[p.campo] || 0), 0))} en total`).join('. ') +
        '. Use las flechas para recorrer los días.' });
    contenedor.appendChild(svg);
    const anchoUtil = ancho - M.izq - M.der;
    const banda = anchoUtil / n;
    const xc = (i) => M.izq + (i + 0.5) * banda;

    const marcas = [];
    paneles.forEach((p, k) => {
      const top = M.arriba + k * (alto + M.entre);
      const max = Math.max(...serie.map((f) => f[p.campo] || 0));
      const { tope, paso } = escalaBonita(max);
      const y = (v) => top + alto - (v / tope) * alto;
      el('text', { x: M.izq, y: top - 9, class: 'rot' }, svg).textContent = p.etiqueta;
      for (let v = 0; v <= tope + 1e-9; v += paso) {
        el('line', { x1: M.izq, x2: ancho - M.der, y1: y(v), y2: y(v), class: v === 0 ? 'base' : 'reja' }, svg);
        el('text', { x: M.izq - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'eje' }, svg).textContent = num(v);
      }
      const g = el('g', {}, svg);
      const puntos = serie.map((f, i) => [xc(i), y(f[p.campo] || 0)]);
      if (p.forma === 'columnas') {
        const w = Math.max(1, Math.min(24, banda - 2));
        const barras = serie.map((f, i) => {
          const v = f[p.campo] || 0;
          if (!v) return null;
          const h = alto * (v / tope);
          return el('path', { d: columna(xc(i) - w / 2, top + alto - h, w, h), style: 'fill:' + p.color }, g);
        });
        marcas.push({ tipo: 'columnas', barras });
      } else {
        const linea = puntos.map((pt, i) => (i ? 'L' : 'M') + pt[0].toFixed(1) + ',' + pt[1].toFixed(1)).join('');
        el('path', { d: `${linea}L${puntos[n - 1][0]},${top + alto}L${puntos[0][0]},${top + alto}Z`, style: 'fill:' + p.color + ';fill-opacity:.1' }, g);
        el('path', { d: linea, fill: 'none', style: 'stroke:' + p.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
        const [ux, uy] = puntos[n - 1];
        el('circle', { cx: ux, cy: uy, r: 4, style: 'fill:' + p.color + ';stroke:var(--surface)', 'stroke-width': 2 }, g);
        const punto = el('circle', { r: 4.5, style: 'fill:' + p.color + ';stroke:var(--surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
        marcas.push({ tipo: 'linea', punto, puntos });
      }
    });

    // Eje de fechas (una sola vez, abajo).
    const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(anchoUtil / 78))));
    for (let i = 0; i < n; i += cada) {
      el('text', { x: xc(i), y: altoTotal - 6, 'text-anchor': 'middle', class: 'eje' }, svg).textContent = fechaCorta(serie[i].fecha);
    }

    // Cursor y detalle.
    const cursor = el('line', { y1: M.arriba - 4, y2: altoTotal - M.abajo, class: 'cursor', visibility: 'hidden' }, svg);
    const tip = document.createElement('div');
    tip.className = 'tip';
    tip.hidden = true;
    contenedor.appendChild(tip);
    let activo = -1;
    const mostrar = (i) => {
      activo = i;
      const x = xc(i);
      cursor.setAttribute('x1', x); cursor.setAttribute('x2', x); cursor.setAttribute('visibility', 'visible');
      marcas.forEach((m) => {
        if (m.tipo === 'linea') { m.punto.setAttribute('cx', m.puntos[i][0]); m.punto.setAttribute('cy', m.puntos[i][1]); m.punto.setAttribute('visibility', 'visible'); }
        else m.barras.forEach((b, j) => b && b.setAttribute('fill-opacity', j === i ? 1 : 0.45));
      });
      const f = serie[i];
      tip.innerHTML = `<b>${esc(fechaConDia(f.fecha))}</b><br>` +
        paneles.map((p) => `<i style="background:${p.color}"></i>${esc(p.etiqueta)}: <b>${num(f[p.campo] || 0)}</b>`).join('<br>');
      tip.hidden = false;
      const escala = contenedor.clientWidth / ancho;
      const izq = Math.min(Math.max(x * escala, 70), contenedor.clientWidth - 70);
      tip.style.left = izq + 'px';
      tip.style.top = (M.arriba - 6) * escala + 'px';
    };
    const ocultar = () => {
      activo = -1;
      cursor.setAttribute('visibility', 'hidden');
      tip.hidden = true;
      marcas.forEach((m) => (m.tipo === 'linea' ? m.punto.setAttribute('visibility', 'hidden') : m.barras.forEach((b) => b && b.removeAttribute('fill-opacity'))));
    };
    const indice = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * ancho;
      return Math.min(n - 1, Math.max(0, Math.floor((x - M.izq) / banda)));
    };
    svg.addEventListener('pointermove', (ev) => mostrar(indice(ev)));
    svg.addEventListener('pointerdown', (ev) => mostrar(indice(ev)));
    svg.addEventListener('pointerleave', ocultar);
    svg.addEventListener('blur', ocultar);
    svg.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight') { mostrar(Math.min(n - 1, activo + 1)); ev.preventDefault(); }
      if (ev.key === 'ArrowLeft') { mostrar(Math.max(0, activo < 0 ? n - 1 : activo - 1)); ev.preventDefault(); }
      if (ev.key === 'Escape') ocultar();
    });
  };
  dibujar();
  const obs = new ResizeObserver(() => dibujar());
  obs.observe(contenedor);
  return () => obs.disconnect();
}
