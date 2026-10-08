'use client';

import { useActionState, useRef, useEffect } from 'react';
import { agregarAccionador } from '@/app/(tablero)/links/acciones';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

const campo = 'rounded-lg border border-linea bg-superficie px-2.5 py-1.5 text-tinta';
const etiqueta = 'flex flex-col gap-1 text-[12.5px] text-suave';

// Formulario para agregar un accionador nuevo (un enlace medido, un evento del sitio o un dato de Analytics).
export function FormularioAccionador({ plataformas, tipos }: { plataformas: string[]; tipos: string[] }) {
  const [estado, accion, enviando] = useActionState<Resultado | null, FormData>(agregarAccionador, null);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado?.ok) formulario.current?.reset(); }, [estado]);

  return (
    <form ref={formulario} action={accion} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className={`${etiqueta} lg:col-span-2`}>
        Plataforma (dónde se usa)
        <input name="plataforma" required list="plataformas" placeholder="Ej.: Instagram, Brevo, Explee" className={campo} />
        <datalist id="plataformas">{plataformas.map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Tipo
        <input name="tipo" required list="tipos" defaultValue="Enlace medido" className={campo} />
        <datalist id="tipos">{tipos.map((t) => <option key={t} value={t} />)}</datalist>
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Nombre
        <input name="accionador" required placeholder="Ej.: WhatsApp desde LinkedIn" className={campo} />
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-6`}>
        Enlace
        <input name="enlace" type="url" placeholder="https://www.wiptool.com/…" className={campo} />
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-6`}>
        Qué hace
        <textarea name="que_hace" rows={2} className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-3`}>
        Dónde se ve en el tablero
        <input name="donde_se_ve" placeholder="Ej.: Resumen › Clics a WhatsApp y a la agenda por origen" className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-3`}>
        Dónde se pone
        <input name="donde_se_usa" placeholder="Ej.: Bio de LinkedIn" className={campo} />
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <button type="submit" disabled={enviando}
          className="rounded-full bg-tinta px-4 py-2 font-semibold text-fondo transition hover:opacity-90 disabled:opacity-60">
          {enviando ? 'Guardando…' : 'Agregar accionador'}
        </button>
        {estado && <span role="status" className={`text-[12.5px] ${estado.ok ? 'text-bueno' : 'text-malo'}`}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}
