'use client';

import { useActionState, useEffect, useRef } from 'react';
import { guardarFactura } from '@/app/(tablero)/general/acciones';
import type { Resultado } from '@/app/(tablero)/costos/acciones';

const campo = 'rounded-lg border border-linea bg-superficie px-2.5 py-1.5 text-tinta';
const etiqueta = 'flex flex-col gap-1 text-[12.5px] text-suave';

// Facturación de un cliente en un mes (si ya existe, se reemplaza).
export function FormularioFactura({ mes, clientes }: { mes: string; clientes: string[] }) {
  const [estado, enviar, enviando] = useActionState<Resultado | null, FormData>(guardarFactura, null);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado?.ok) formulario.current?.reset(); }, [estado]);
  return (
    <form ref={formulario} action={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <label className={etiqueta}>
        Mes facturado
        <input name="mes" id="mes-factura" type="month" required defaultValue={mes} className={campo} />
      </label>
      <label className={`${etiqueta} lg:col-span-2`}>
        Cliente (como se llama en la plataforma)
        <input name="cliente" id="cliente-factura" required list="clientes-factura" placeholder="Ej.: ASISYA" className={campo} />
        <datalist id="clientes-factura">{clientes.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <label className={etiqueta}>
        Valor facturado
        <input name="valor" id="valor-factura" required inputMode="decimal" placeholder="2.500.000" className={`${campo} tabular-nums`} />
      </label>
      <label className={etiqueta}>
        Moneda
        <select name="moneda" id="moneda-factura" defaultValue="COP" className={campo}>
          <option value="COP">Pesos (COP)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </label>
      <label className={etiqueta}>
        Nota
        <input name="nota" id="nota-factura" placeholder="Ej.: plan 4" className={campo} />
      </label>
      <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-6">
        <button type="submit" disabled={enviando}
          className="rounded-full bg-tinta px-4 py-2 font-semibold text-fondo transition hover:opacity-90 disabled:opacity-60">
          {enviando ? 'Guardando…' : 'Guardar facturación'}
        </button>
        {estado && <span role="status" className={`text-[12.5px] ${estado.ok ? 'text-bueno' : 'text-malo'}`}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}
