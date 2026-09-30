'use client';

// Botón "Eliminar" con confirmación antes de enviar (borrar no se puede deshacer).
export function BotonEliminar({ accion, id, pregunta, titulo }: {
  accion: (datos: FormData) => Promise<void>; id: number; pregunta: string; titulo?: string;
}) {
  return (
    <form action={accion} onSubmit={(e) => { if (!confirm(pregunta)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" title={titulo}
        className="rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-malo hover:text-malo">
        Eliminar
      </button>
    </form>
  );
}
