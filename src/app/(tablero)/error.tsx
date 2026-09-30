'use client';

// Si la base o la carga fallan, se explica qué hacer en vez de mostrar una página en blanco.
export default function ErrorTablero({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-[10px] border border-l-4 border-linea border-l-aviso bg-superficie px-3.5 py-2.5 text-[13px]">
      <strong className="font-semibold">No se pudieron cargar los datos.</strong> {error.message}.{' '}
      Vuelve a intentarlo; si sigue fallando, revisa que la carga de n8n esté funcionando.{' '}
      <button type="button" onClick={reset} className="ml-1 underline">Reintentar</button>
    </div>
  );
}
