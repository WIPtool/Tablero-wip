'use client';

import { eliminarCosto } from '@/app/(tablero)/costos/acciones';

// Eliminar borra el costo de todos los meses: se pide confirmación antes de enviar.
export function BotonEliminarCosto({ id, plataforma }: { id: number; plataforma: string }) {
  return (
    <form
      action={eliminarCosto}
      onSubmit={(e) => {
        if (!confirm(`¿Eliminar ${plataforma}? Se quita de la inversión de todos los meses. Si solo dejaron de pagarlo, usa "Terminar hoy".`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" title="Lo borra también de los meses anteriores"
        className="rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-malo hover:text-malo">
        Eliminar
      </button>
    </form>
  );
}
