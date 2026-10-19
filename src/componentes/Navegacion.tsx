'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PAGINAS, PROXIMAS, SECCIONES, buscarPagina, seccionDe, type Pagina, type Seccion } from '@/lib/paginas';

// Enlaces de la barra lateral. Conservan el periodo elegido (?p=…) al cambiar de página.
// Las áreas (WIP General, Marketing, Operaciones) van una debajo de otra; al hacer clic en una se despliegan sus páginas.
// El área de la página actual queda abierta.
export function Navegacion({ pie }: { pie: React.ReactNode }) {
  const ruta = usePathname();
  const params = useSearchParams();
  const [abierto, setAbierto] = useState(false);
  const consulta = ['p', 'desde', 'hasta'].filter((k) => params.get(k)).map((k) => `${k}=${params.get(k)}`).join('&');
  const seccion = seccionDe(buscarPagina(ruta.split('/')[1] ?? ''));
  // Lo que la persona abrió o cerró con un clic; si no ha tocado un área, solo está abierta la de la página actual.
  const [elegidas, setElegidas] = useState<Partial<Record<Seccion, boolean>>>({});
  const estaDesplegada = (s: Seccion) => elegidas[s] ?? s === seccion;
  const alternar = (s: Seccion) => setElegidas((e) => ({ ...e, [s]: !estaDesplegada(s) }));

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
        <span>{p.menu ?? p.titulo}</span>
        {p.etapa && <span className="rounded-full border border-current px-1.5 text-[10.5px] opacity-80">{p.etapa}</span>}
      </Link>
    );
  };

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
        <nav aria-label="Páginas del tablero" className="flex flex-col gap-1.5">
          {SECCIONES.map((s) => {
            const activa = s.id === seccion;
            const desplegada = estaDesplegada(s.id);
            const paginas = PAGINAS.filter((p) => seccionDe(p) === s.id);
            const proximas = PROXIMAS.filter((p) => seccionDe(p) === s.id);
            return (
              <div key={s.id} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => alternar(s.id)}
                  aria-expanded={desplegada}
                  aria-controls={`area-${s.id}`}
                  className={`flex items-center justify-between gap-2 rounded-[9px] px-2.5 py-2 text-left text-[12px] font-bold uppercase tracking-[0.08em] transition-colors ${
                    activa ? 'text-white' : 'text-lateral-suave hover:bg-white/5 hover:text-lateral-tinta'
                  }`}
                >
                  <span>{s.titulo}</span>
                  <svg aria-hidden="true" viewBox="0 0 16 16" className={`h-3.5 w-3.5 shrink-0 transition-transform ${desplegada ? 'rotate-180' : ''}`}>
                    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {desplegada && (
                  <div id={`area-${s.id}`} className="ml-2.5 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                    {paginas.map(enlace)}
                    {proximas.length > 0 && (
                      <>
                        <div className="px-2.5 pb-1.5 pt-3 text-[10.5px] uppercase tracking-[0.12em] text-lateral-suave">Próximas etapas</div>
                        {proximas.map(enlace)}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        {pie}
      </div>
    </>
  );
}
