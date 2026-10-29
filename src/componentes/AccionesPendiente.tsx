'use client';

import { useActionState, useState } from 'react';
import { guardarInstruccion } from '@/app/(tablero)/pendientes-misha/acciones';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

const campo = 'rounded-lg border border-linea bg-superficie px-2.5 py-1.5 text-tinta';
const boton = 'rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-tenue hover:text-tinta';

// Botones de un pendiente: los de estado (Hecho, Descartar) llegan como children desde el servidor y aquí se suma
// "Tomar acción", que abre una caja para escribirle a Claude qué hacer con el correo.
export function AccionesPendiente({ id, instruccion, children }: { id: number; instruccion: string; children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState<Resultado | null, FormData>(async (previo, datos) => {
    const r = await guardarInstruccion(previo, datos);
    if (r.ok) setAbierto(false);
    return r;
  }, null);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-controls={`instruccion-${id}`}
          className="rounded-lg border border-tinta px-2.5 py-1 text-[12.5px] font-semibold text-tinta hover:opacity-80">
          Tomar acción
        </button>
        {estado?.ok && !abierto && <span role="status" className="text-[12.5px] text-bueno">{estado.mensaje}</span>}
      </div>
      {abierto && (
        <form id={`instruccion-${id}`} action={accion} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1 text-[12.5px] text-suave">
            Qué debe hacer Claude con este correo
            <textarea name="instruccion" rows={3} required autoFocus defaultValue={instruccion}
              placeholder="Ej.: respóndele que sí y propón el jueves a las 10; o crea el borrador y no lo envíes" className={campo} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={enviando}
              className="rounded-full bg-tinta px-4 py-1.5 text-[13px] font-semibold text-fondo transition hover:opacity-90 disabled:opacity-60">
              {enviando ? 'Guardando…' : 'Guardar instrucción'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={boton}>Cancelar</button>
            {estado && !estado.ok && <span role="status" className="text-[12.5px] text-malo">{estado.mensaje}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
