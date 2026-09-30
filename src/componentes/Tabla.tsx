'use client';

import { useState } from 'react';
import { num, pct, pos } from '@/lib/formato';

// Tipos de columna. Los de enlace se resuelven aquí (no se pueden pasar funciones desde el servidor).
export type TipoColumna = 'texto' | 'numero' | 'pct' | 'pos' | 'ruta-sitio' | 'url-google';
export interface Columna { campo: string; etiqueta: string; tipo?: TipoColumna; barra?: boolean }
type Fila = Record<string, string | number | null>;

const esNumero = (t?: TipoColumna) => t === 'numero' || t === 'pct' || t === 'pos';

function Celda({ valor, tipo }: { valor: Fila[string]; tipo?: TipoColumna }) {
  if (tipo === 'numero') return <>{num(valor as number)}</>;
  if (tipo === 'pct') return <>{pct(valor as number)}</>;
  if (tipo === 'pos') return <>{pos(valor as number)}</>;
  const texto = String(valor ?? '');
  if (tipo === 'ruta-sitio' && texto.startsWith('/')) {
    return <a className="enlace-tabla" href={`https://www.wiptool.com${texto}`} target="_blank" rel="noopener">{texto}</a>;
  }
  if (tipo === 'url-google' && /^https?:\/\//.test(texto)) {
    // Del dominio principal se muestra solo la ruta; de cualquier otra variante (sin www, http…), la dirección completa.
    const principal = /^https:\/\/(www\.wiptool\.com|platform\.wiptool\.com)(\/|$)/.test(texto);
    const corto = principal ? texto.replace(/^https:\/\/[^/]+/, '') || '/' : texto.replace(/^https:\/\//, '');
    return <a className="enlace-tabla" href={texto} target="_blank" rel="noopener">{corto}</a>;
  }
  return <>{texto}</>;
}

export function Tabla({ columnas, filas, limite = 10, total = false, vacio = 'Sin datos en este periodo.' }: {
  columnas: Columna[]; filas: Fila[]; limite?: number; total?: boolean; vacio?: string;
}) {
  const [orden, setOrden] = useState(columnas.find((c) => esNumero(c.tipo))?.campo ?? columnas[0].campo);
  const [asc, setAsc] = useState(false);
  const [todo, setTodo] = useState(false);

  const col = columnas.find((c) => c.campo === orden)!;
  const ordenadas = [...filas].sort((a, b) => {
    const x = a[orden], y = b[orden];
    const r = esNumero(col.tipo) ? (Number(x ?? -Infinity) - Number(y ?? -Infinity)) : String(x ?? '').localeCompare(String(y ?? ''), 'es');
    return asc ? r : -r;
  });
  const visibles = todo ? ordenadas : ordenadas.slice(0, limite);
  const barra = columnas.find((c) => c.barra);
  const maxBarra = barra ? Math.max(1, ...filas.map((f) => Number(f[barra.campo]) || 0)) : 1;

  const ordenar = (campo: string) => {
    if (campo === orden) setAsc(!asc);
    else { setOrden(campo); setAsc(!esNumero(columnas.find((c) => c.campo === campo)?.tipo)); }
  };

  return (
    <>
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {columnas.map((c) => (
                <th key={c.campo} aria-sort={c.campo === orden ? (asc ? 'ascending' : 'descending') : undefined}
                  className={`select-none whitespace-nowrap border-b border-linea px-2 py-1.5 text-xs font-medium text-suave ${esNumero(c.tipo) ? 'text-right' : 'text-left'}`}>
                  <button type="button" onClick={() => ordenar(c.campo)} className={`hover:text-tinta ${c.campo === orden ? 'font-semibold text-tinta' : ''}`}>
                    {c.etiqueta}{c.campo === orden ? (asc ? ' ↑' : ' ↓') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.length ? visibles.map((f, i) => (
              <tr key={i} className="border-b border-reja last:border-0">
                {columnas.map((c) => {
                  if (c.barra) {
                    const w = Math.round(((Number(f[c.campo]) || 0) / maxBarra) * 100);
                    return (
                      <td key={c.campo} className="relative min-w-24 whitespace-nowrap px-2 py-[7px] text-right tabular-nums">
                        <div className="absolute right-2 top-1/2 h-[18px] -translate-y-1/2 rounded bg-serie-1/15" style={{ width: `max(0px, calc(${w}% - 16px))` }} />
                        <span className="relative"><Celda valor={f[c.campo]} tipo={c.tipo} /></span>
                      </td>
                    );
                  }
                  return (
                    <td key={c.campo} className={`px-2 py-[7px] ${esNumero(c.tipo) ? 'whitespace-nowrap text-right tabular-nums' : 'max-w-[340px] [overflow-wrap:anywhere]'}`}>
                      <Celda valor={f[c.campo]} tipo={c.tipo} />
                    </td>
                  );
                })}
              </tr>
            )) : (
              <tr><td colSpan={columnas.length} className="px-2 py-5 text-center text-tenue">{vacio}</td></tr>
            )}
          </tbody>
          {total && filas.length > 1 && (
            <tfoot>
              <tr className="border-t border-linea font-semibold">
                {columnas.map((c, i) => (
                  <td key={c.campo} className={`px-2 py-[7px] ${c.tipo === 'numero' ? 'text-right tabular-nums' : ''}`}>
                    {i === 0 ? 'Total' : c.tipo === 'numero' ? num(filas.reduce((a, f) => a + (Number(f[c.campo]) || 0), 0)) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {filas.length > limite && (
        <button type="button" onClick={() => setTodo(!todo)}
          className="self-start rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-tenue hover:text-tinta">
          {todo ? 'Ver menos' : `Ver las ${filas.length}`}
        </button>
      )}
    </>
  );
}
