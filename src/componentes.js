import { num, cambio, esc } from './formato.js';

/**
 * Fila de cifras. Cada item: { etiqueta, valor, anterior?, formato?, menorEsMejor?, principal?, pendiente? }
 * La "principal" es la cifra que encabeza la página (solo una por página).
 */
export function cifras(items) {
  return `<section class="cifras" aria-label="Cifras del periodo">${items.map((c) => {
    if (c.pendiente) {
      return `<div class="cifra pendiente"><span class="etq">${esc(c.etiqueta)}</span><span class="valor">${esc(c.pendiente)}</span>` +
        (c.nota ? `<span class="delta">${esc(c.nota)}</span>` : '') + '</div>';
    }
    const f = c.formato || num;
    const d = cambio(c.valor, c.anterior, { menorEsMejor: c.menorEsMejor });
    const delta = d ? `<span class="delta"><b class="${d.clase}">${esc(d.texto)}</b> vs. periodo anterior (${f(c.anterior)})</span>` : '';
    return `<div class="cifra${c.principal ? ' principal-cifra' : ''}"><span class="etq">${esc(c.etiqueta)}</span>` +
      `<span class="valor">${f(c.valor)}</span>${delta}</div>`;
  }).join('')}</section>`;
}

export function cifrasCargando(n) {
  return `<section class="cifras" aria-hidden="true">${Array.from({ length: n }, () =>
    '<div class="cifra"><span class="etq cargando">Cargando cifra</span><span class="valor cargando">0000</span><span class="delta cargando">vs. periodo anterior</span></div>').join('')}</section>`;
}

export function tarjeta({ id, titulo, nota = '', col = 12, contenido = '' }) {
  return `<section class="tarjeta c-${col}" aria-labelledby="t-${id}"><header><h2 id="t-${id}">${esc(titulo)}</h2>` +
    (nota ? `<span class="nota">${nota}</span>` : '') + `</header><div id="${id}">${contenido || '<div class="cargando" style="height:120px"></div>'}</div></section>`;
}

export function leyenda(items) {
  return `<div class="leyenda">${items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.etiqueta)}</span>`).join('')}</div>`;
}

export const errorHtml = (e) => `<div class="aviso"><div><strong>No se pudieron cargar los datos.</strong> ${esc(e.message || e)}. ` +
  'Recarga la página; si sigue fallando, revisa que la carga de n8n esté funcionando.</div></div>';
