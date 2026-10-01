'use client';

import { useState } from 'react';
import { num, pct, pos, pesos, fechaLarga } from '@/lib/formato';

// Tipos de columna. Los de enlace se resuelven aquí (no se pueden pasar funciones desde el servidor).
export type TipoColumna = 'texto' | 'numero' | 'pesos' | 'pct' | 'pos' | 'fecha' | 'enlace' | 'ruta-sitio' | 'url-google';
export interface Columna { campo: string; etiqueta: string; tipo?: TipoColumna; barra?: boolean; sinTotal?: boolean }
type Fila = Record<string, string | number | null>;

const esNumero = (t?: TipoColumna) => t === 'numero' || t === 'pesos' || t === 'pct' || t === 'pos';

function Celda({ valor, tipo }: { valor: Fila[string]; tipo?: TipoColumna }) {
  if (tipo === 'numero') return <>{num(valor as number)}</>;
  if (tipo === 'pesos') return <>{pesos(valor as number)}</>;
  if (tipo === 'pct') return <>{pct(valor as number)}</>;
  if (tipo === 'pos') return <>{pos(valor as number)}</>;
  const texto = String(valor ?? '');
  if (tipo === 'fecha') return <span className="whitespace-nowrap">{/^\d{4}-\d{2}-\d{2}/.test(texto) ? fechaLarga(texto.slice(0, 10)) : '—'}</span>;
  if (tipo === 'enlace') {
    // Enlace externo (LinkedIn, sitio de la empresa…): se muestra sin https:// ni www.
    if (!/^https?:\/\//.test(texto)) return <>{texto}</>;
    return <a className="enlace-tabla" href={texto} target="_blank" rel="noopener noreferrer">{texto.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>;
  }
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

export function Tabla({ columnas, filas, limite = 10, total = false, vacio = 'Sin datos en este periodo.', orden: ordenInicial, ascendente = false }: {
  columnas: Columna[]; filas: Fila[]; limite?: number; total?: boolean; vacio?: string; orden?: string; ascendente?: boolean;
}) {
  const [orden, setOrden] = useState(ordenInicial ?? columnas.find((c) => esNumero(c.tipo))?.campo ?? columnas[0].campo);
  const [asc, setAsc] = useState(ascendente);
  const [todo, setTodo] = useState(false);

  // El orden puede ser por un campo que no se muestra (por ejemplo, el orden de las etapas del embudo).
  const col = columnas.find((c) => c.campo === orden);
  const ordenadas = [...filas].sort((a, b) => {
    const x = a[orden], y = b[orden];
    const r = (col ? esNumero(col.tipo) : typeof x === 'number') ? (Number(x ?? -Infinity) - Number(y ?? -Infinity)) : String(x ?? '').localeCompare(String(y ?? ''), 'es');
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
                  <td key={c.campo} className={`px-2 py-[7px] ${esNumero(c.tipo) ? 'text-right tabular-nums' : ''}`}>
                    {i === 0 ? 'Total' : c.sinTotal ? '' : c.tipo === 'numero' ? num(filas.reduce((a, f) => a + (Number(f[c.campo]) || 0), 0)) : c.tipo === 'pesos' ? pesos(filas.reduce((a, f) => a + (Number(f[c.campo]) || 0), 0)) : ''}
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
