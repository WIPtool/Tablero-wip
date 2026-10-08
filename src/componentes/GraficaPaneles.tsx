'use client';

import { useEffect, useRef, useState } from 'react';
import { num, fechaCorta, fechaConDia } from '@/lib/formato';

// Paneles apilados que comparten el eje de fechas (nunca dos escalas en un mismo eje). Con juntos=true todas las series
// van en una sola gráfica con un único eje vertical (como Analytics): sirve cuando las cifras se pueden leer en la misma escala.
// Un cursor recorre todos los paneles y muestra el detalle del día; también con las flechas del teclado.
export interface Panel { campo: string; etiqueta: string; forma: 'linea' | 'columnas'; color: string; area?: boolean }
type Punto = { fecha: string } & Record<string, number | string>;

const M = { izq: 44, der: 14, arriba: 22, abajo: 26, entre: 34 };

function escalaBonita(max: number) {
  if (!max || max <= 0) return { tope: 4, paso: 1 };
  const bruto = max / 3;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const n = bruto / mag;
  let paso = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  if (paso < 1) paso = 1;
  return { tope: Math.ceil(max / paso) * paso, paso };
}

// Columna con la punta redondeada (4 px) y la base recta sobre el eje.
function columna(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function GraficaPaneles({ serie, paneles, alto = 128, juntos = false }: { serie: Punto[]; paneles: Panel[]; alto?: number; juntos?: boolean }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [activo, setActivo] = useState(-1);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(280, Math.round(el.clientWidth)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (!serie.length) return <p className="py-10 text-center text-[12.5px] text-suave">Sin datos en este periodo.</p>;

  const n = serie.length;
  // En modo juntos hay un solo panel que dibuja todas las series con la misma escala; las columnas van detrás de las líneas.
  const grupos: Panel[][] = juntos ? [[...paneles].sort((a, b) => (a.forma === 'columnas' ? 0 : 1) - (b.forma === 'columnas' ? 0 : 1))] : paneles.map((p) => [p]);
  const altoTotal = M.arriba + grupos.length * alto + (grupos.length - 1) * M.entre + M.abajo;
  const anchoUtil = Math.max(1, ancho - M.izq - M.der);
  const banda = anchoUtil / n;
  const xc = (i: number) => M.izq + (i + 0.5) * banda;
  const cada = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(anchoUtil / 78))));

  const indice = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * ancho;
    return Math.min(n - 1, Math.max(0, Math.floor((x - M.izq) / banda)));
  };
  const teclado = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { setActivo((a) => Math.min(n - 1, a + 1)); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { setActivo((a) => Math.max(0, a < 0 ? n - 1 : a - 1)); e.preventDefault(); }
    if (e.key === 'Escape') setActivo(-1);
  };

  const descripcion = paneles.map((p) => `${p.etiqueta}: ${num(serie.reduce((a, f) => a + (Number(f[p.campo]) || 0), 0))} en total`).join('. ')
    + '. Use las flechas para recorrer los días.';

  return (
    <div ref={caja} className="relative w-full">
      {ancho > 0 && (
        <svg viewBox={`0 0 ${ancho} ${altoTotal}`} className="block h-auto w-full overflow-visible" role="img" aria-label={descripcion}
          tabIndex={0} onPointerMove={(e) => setActivo(indice(e))} onPointerDown={(e) => setActivo(indice(e))}
          onPointerLeave={() => setActivo(-1)} onBlur={() => setActivo(-1)} onKeyDown={teclado}>
          {grupos.map((grupo, k) => {
            const top = M.arriba + k * (alto + M.entre);
            const max = Math.max(...grupo.flatMap((p) => serie.map((f) => Number(f[p.campo]) || 0)));
            const { tope, paso } = escalaBonita(max);
            const y = (v: number) => top + alto - (v / tope) * alto;
            const marcas = [];
            for (let v = 0; v <= tope + 1e-9; v += paso) marcas.push(v);
            const columnas = grupo.filter((p) => p.forma === 'columnas');
            const w = Math.max(1, Math.min(24, (banda - 2) / Math.max(1, columnas.length)));
            return (
              <g key={grupo.map((p) => p.campo).join('-')}>
                {!juntos && <text x={M.izq} y={top - 9} className="fill-suave text-[11.5px] font-semibold">{grupo[0].etiqueta}</text>}
                {marcas.map((v) => (
                  <g key={v}>
                    <line x1={M.izq} x2={ancho - M.der} y1={y(v)} y2={y(v)} className={v === 0 ? 'stroke-linea' : 'stroke-reja'} />
                    <text x={M.izq - 8} y={y(v) + 4} textAnchor="end" className="fill-tenue text-[11px] tabular-nums">{num(v)}</text>
                  </g>
                ))}
                {grupo.map((p) => {
                  if (p.forma === 'columnas') {
                    const c = columnas.indexOf(p);
                    return serie.map((f, i) => {
                      const v = Number(f[p.campo]) || 0;
                      if (!v) return null;
                      const h = alto * (v / tope);
                      const x0 = xc(i) - (w * columnas.length) / 2 + c * w;
                      return <path key={p.campo + i} d={columna(x0 + (columnas.length > 1 ? 1 : 0), top + alto - h, w - (columnas.length > 1 ? 2 : 0), h)} style={{ fill: p.color }}
                        fillOpacity={activo < 0 || activo === i ? 1 : 0.45} />;
                    });
                  }
                  const puntos = serie.map((f, i) => [xc(i), y(Number(f[p.campo]) || 0)] as const);
                  const linea = puntos.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join('');
                  const conArea = p.area ?? !juntos;
                  return (
                    <g key={p.campo}>
                      {conArea && <path d={`${linea}L${puntos[n - 1][0]},${top + alto}L${puntos[0][0]},${top + alto}Z`} style={{ fill: p.color, fillOpacity: 0.1 }} />}
                      <path d={linea} fill="none" style={{ stroke: p.color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                      {juntos && n <= 45 && puntos.map((pt, i) => (
                        <circle key={i} cx={pt[0]} cy={pt[1]} r={2.5} style={{ fill: p.color }} />
                      ))}
                      <circle cx={puntos[n - 1][0]} cy={puntos[n - 1][1]} r={4} style={{ fill: p.color, stroke: 'var(--surface)' }} strokeWidth={2} />
                      {activo >= 0 && (
                        <circle cx={puntos[activo][0]} cy={puntos[activo][1]} r={4.5} style={{ fill: p.color, stroke: 'var(--surface)' }} strokeWidth={2} />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          {serie.map((f, i) => (i % cada === 0 ? (
            <text key={f.fecha} x={xc(i)} y={altoTotal - 6} textAnchor="middle" className="fill-tenue text-[11px]">{fechaCorta(f.fecha)}</text>
          ) : null))}
          {activo >= 0 && <line x1={xc(activo)} x2={xc(activo)} y1={M.arriba - 4} y2={altoTotal - M.abajo} className="stroke-tenue" />}
        </svg>
      )}
      {activo >= 0 && ancho > 0 && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-tinta px-2.5 py-2 text-xs leading-[1.45] text-fondo shadow-xl"
          style={{ left: Math.min(Math.max(xc(activo), 70), ancho - 70), top: M.arriba - 6 }}>
          <b className="font-semibold">{fechaConDia(serie[activo].fecha)}</b>
          {paneles.map((p) => (
            <div key={p.campo}>
              <i className="mr-1.5 inline-block size-2 rounded-full" style={{ background: p.color }} />
              {p.etiqueta}: <b className="font-semibold">{num(Number(serie[activo][p.campo]) || 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
