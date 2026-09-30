'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { PRESETS, type Preset, type Rango } from '@/lib/rango';

// Cambia el periodo en la dirección (?p=…); la página se vuelve a pedir al servidor con ese periodo.
export function SelectorPeriodo({ rango }: { rango: Rango }) {
  const router = useRouter();
  const ruta = usePathname();
  const [cargando, iniciar] = useTransition();

  const ir = (preset: Preset, desde?: string, hasta?: string) => {
    const q = preset === '28' ? '' : preset === 'otro' ? `?p=otro&desde=${desde}&hasta=${hasta}` : `?p=${preset}`;
    iniciar(() => router.push(ruta + q, { scroll: false }));
  };

  const cambiarFecha = (campo: 'desde' | 'hasta', valor: string) => {
    const desde = campo === 'desde' ? valor : rango.desde;
    const hasta = campo === 'hasta' ? valor : rango.hasta;
    if (desde && hasta && desde <= hasta) ir('otro', desde, hasta);
  };

  return (
    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 md:justify-end" aria-busy={cargando}>
      <div role="group" aria-label="Periodo" className="flex max-w-full gap-0.5 overflow-x-auto rounded-[10px] border border-linea bg-superficie p-[3px]">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={p.id === rango.preset}
            onClick={() => ir(p.id, rango.desde, rango.hasta)}
            className={`whitespace-nowrap rounded-[7px] px-2.5 py-1.5 font-medium transition-colors ${
              p.id === rango.preset ? 'bg-tinta text-fondo' : 'text-suave hover:text-tinta'
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>
      {rango.preset === 'otro' && (
        <div className="flex items-center gap-1.5">
          <label htmlFor="desde" className="sr-only">Desde</label>
          <input id="desde" type="date" defaultValue={rango.desde} onChange={(e) => cambiarFecha('desde', e.target.value)}
            className="rounded-lg border border-linea bg-superficie px-2 py-1" />
          <span aria-hidden>–</span>
          <label htmlFor="hasta" className="sr-only">Hasta</label>
          <input id="hasta" type="date" defaultValue={rango.hasta} onChange={(e) => cambiarFecha('hasta', e.target.value)}
            className="rounded-lg border border-linea bg-superficie px-2 py-1" />
        </div>
      )}
      {cargando && <span className="text-xs text-suave">Actualizando…</span>}
    </div>
  );
}
