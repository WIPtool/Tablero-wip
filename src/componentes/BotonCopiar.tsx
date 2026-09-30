'use client';

import { useState } from 'react';

// Copia un texto (un enlace medido) al portapapeles.
export function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin permiso */ }
      }}
      className="rounded-md border border-linea px-2 py-0.5 text-[11.5px] text-suave hover:border-tenue hover:text-tinta"
    >
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  );
}
