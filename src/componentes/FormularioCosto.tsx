'use client';

import { useActionState, useRef, useEffect } from 'react';
import { agregarCosto, type Resultado } from '@/app/(tablero)/costos/acciones';

const campo = 'rounded-lg border border-linea bg-superficie px-2.5 py-1.5 text-tinta';

// Formulario para agregar una suscripción o costo fijo.
export function FormularioCosto({ hoy }: { hoy: string }) {
  const [estado, accion, enviando] = useActionState<Resultado | null, FormData>(agregarCosto, null);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado?.ok) formulario.current?.reset(); }, [estado]);

  return (
    <form ref={formulario} action={accion} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className="flex flex-col gap-1 text-[12.5px] text-suave lg:col-span-2">
        Plataforma o suscripción
        <input name="plataforma" id="plataforma" required placeholder="Ej.: Kommo, n8n, Canva" className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-suave">
        Costo mensual
        <input name="monto" id="monto" required inputMode="decimal" placeholder="17" className={`${campo} tabular-nums`} />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-suave">
        Moneda
        <select name="moneda" id="moneda" defaultValue="USD" className={campo}>
          <option value="USD">Dólares (USD)</option>
          <option value="COP">Pesos (COP)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-suave">
        Desde
        <input name="desde" id="desde-costo" type="date" required defaultValue={hoy} className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-suave">
        Hasta (vacío si sigue)
        <input name="hasta" id="hasta-costo" type="date" className={campo} />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px] text-suave sm:col-span-2 lg:col-span-4">
        Nota
        <input name="nota" id="nota" placeholder="Ej.: plan Starter" className={campo} />
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-2">
        <button type="submit" disabled={enviando}
          className="rounded-full bg-tinta px-4 py-2 font-semibold text-fondo transition hover:opacity-90 disabled:opacity-60">
          {enviando ? 'Guardando…' : 'Agregar costo'}
        </button>
        {estado && <span role="status" className={`text-[12.5px] ${estado.ok ? 'text-bueno' : 'text-malo'}`}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}
