'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PAGINAS, PROXIMAS, SECCIONES, buscarPagina, seccionDe, type Pagina } from '@/lib/paginas';

// Enlaces de la barra lateral. Conservan el periodo elegido (?p=…) al cambiar de página.
// Arriba, el selector WIP General / Marketing / Operaciones muestra solo las páginas de esa sección.
export function Navegacion({ pie }: { pie: React.ReactNode }) {
  const ruta = usePathname();
  const params = useSearchParams();
  const [abierto, setAbierto] = useState(false);
  const consulta = ['p', 'desde', 'hasta'].filter((k) => params.get(k)).map((k) => `${k}=${params.get(k)}`).join('&');
  const seccion = seccionDe(buscarPagina(ruta.split('/')[1] ?? ''));
  const deSeccion = (p: Pagina) => seccionDe(p) === seccion;

  const enlace = (p: Pagina) => {
    const activo = ruta === `/${p.id}`;
    return (
      <Link
        key={p.id}
        href={`/${p.id}${!p.etapa && consulta ? '?' + consulta : ''}`}
        onClick={() => setAbierto(false)}
        aria-current={activo ? 'page' : undefined}
        className={`flex items-center justify-between gap-2 rounded-[9px] px-2.5 py-2 font-medium no-underline transition-colors ${
          activo ? 'bg-lima font-semibold text-navy' : p.etapa ? 'text-lateral-suave hover:bg-white/5' : 'text-lateral-tinta hover:bg-white/5'
        }`}
      >
        <span>{p.titulo}</span>
        {p.etapa && <span className="rounded-full border border-current px-1.5 text-[10.5px] opacity-80">{p.etapa}</span>}
      </Link>
    );
  };

  const proximas = PROXIMAS.filter(deSeccion);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        aria-controls="cajon"
        className="ml-auto rounded-lg border border-white/20 px-3 py-1.5 text-lateral-tinta md:hidden"
      >
        Menú
      </button>
      <div
        id="cajon"
        className={`${abierto ? 'flex' : 'hidden'} absolute inset-x-0 top-full max-h-[75vh] flex-col gap-3.5 overflow-y-auto bg-lateral px-4 pb-5 pt-2 shadow-2xl md:static md:flex md:max-h-none md:flex-1 md:gap-5 md:overflow-visible md:p-0 md:shadow-none`}
      >
        <nav aria-label="Sección del tablero" className="grid grid-cols-2 gap-0.5 rounded-[11px] border border-white/15 p-0.5">
          {SECCIONES.map((s) => {
            const activa = s.id === seccion;
            return (
              <Link
                key={s.id}
                href={`/${s.inicio}${consulta ? '?' + consulta : ''}`}
                onClick={() => setAbierto(false)}
                aria-current={activa ? 'true' : undefined}
                className={`rounded-[9px] px-2 py-1.5 text-center text-[13px] font-semibold no-underline transition-colors ${s.id === 'general' ? 'col-span-2 ' : ''}${
                  activa ? 'bg-white/15 text-white' : 'text-lateral-suave hover:bg-white/5 hover:text-lateral-tinta'
                }`}
              >
                {s.titulo}
              </Link>
            );
          })}
        </nav>
        <nav aria-label="Páginas del tablero" className="flex flex-col gap-0.5">
          {PAGINAS.filter(deSeccion).map(enlace)}
          {proximas.length > 0 && (
            <>
              <div className="px-2.5 pb-1.5 pt-3.5 text-[10.5px] uppercase tracking-[0.12em] text-lateral-suave">Próximas etapas</div>
              {proximas.map(enlace)}
            </>
          )}
        </nav>
        {pie}
      </div>
    </>
  );
}
