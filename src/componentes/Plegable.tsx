'use client';

import { useEffect, useRef, useState } from 'react';

// Altura máxima del contenido de una tarjeta (unas 5 líneas); lo que pase de ahí queda oculto hasta "Ver más".
const ALTURA = 112;

// Corta el contenido largo con un desvanecido y un botón para expandirlo; si cabe completo, no muestra nada extra.
export function Plegable({ id, children }: { id: string; children: React.ReactNode }) {
  const contenido = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [sobra, setSobra] = useState(false);

  useEffect(() => {
    const el = contenido.current;
    if (!el) return;
    const medir = () => setSobra(el.offsetHeight > ALTURA + 4);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const cortado = sobra && !abierto;
  return (
    <div className="flex flex-col gap-1">
      <div id={id} style={{ maxHeight: abierto ? undefined : ALTURA }}
        className={`overflow-hidden ${cortado ? '[mask-image:linear-gradient(to_bottom,#000_60%,transparent)]' : ''}`}>
        <div ref={contenido} className="flex flex-col gap-2.5">{children}</div>
      </div>
      {sobra && (
        <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-controls={id}
          className="self-start text-[12.5px] font-medium text-suave hover:text-tinta">
          {abierto ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}
