'use client';

import { useActionState, useRef, useEffect } from 'react';
import { agregarPropuesta } from '@/app/(tablero)/links/acciones';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

const campo = 'rounded-lg border border-linea bg-superficie px-2.5 py-1.5 text-tinta';
const etiqueta = 'flex flex-col gap-1 text-[12.5px] text-suave';

// Formulario para agregar una propuesta, un informe o un documento enviado a un cliente.
export function FormularioPropuesta({ tipos }: { tipos: string[] }) {
  const [estado, accion, enviando] = useActionState<Resultado | null, FormData>(agregarPropuesta, null);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado?.ok) formulario.current?.reset(); }, [estado]);

  return (
    <form ref={formulario} action={accion} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className={`${etiqueta} lg:col-span-2`}>
        Cliente
        <input name="cliente" required placeholder="Ej.: Asisya" className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-3`}>
        Documento
        <input name="documento" required placeholder="Ej.: Propuesta integral" className={campo} />
      </label>
      <label className={etiqueta}>
        Fecha
        <input name="fecha" type="date" className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Tipo
        <input name="tipo" required list="tipos-propuesta" defaultValue="Propuesta comercial" className={campo} />
        <datalist id="tipos-propuesta">{tipos.map((t) => <option key={t} value={t} />)}</datalist>
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-4`}>
        Enlace
        <input name="enlace" type="url" required placeholder="https://www.wiptool.com/cotizaciones/…" className={campo} />
      </label>
      <label className={`${etiqueta} sm:col-span-2 lg:col-span-6`}>
        Notas
        <textarea name="notas" rows={2} placeholder="Ej.: enviada por correo a gerencia; versión con integración" className={campo} />
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <button type="submit" disabled={enviando}
          className="rounded-full bg-tinta px-4 py-2 font-semibold text-fondo transition hover:opacity-90 disabled:opacity-60">
          {enviando ? 'Guardando…' : 'Agregar propuesta'}
        </button>
        {estado && <span role="status" className={`text-[12.5px] ${estado.ok ? 'text-bueno' : 'text-malo'}`}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}
