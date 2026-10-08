import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado } from '@/componentes/Bloques';
import { ListaAccionadores } from '@/componentes/ListaAccionadores';
import { ListaPropuestas } from '@/componentes/ListaPropuestas';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Links de interés' };

// Links de interés: pestañas Accionadores (?ver=accionadores, la de entrada) y Propuestas (?ver=propuestas).
const PESTANAS = [
  { id: 'accionadores', titulo: 'Accionadores' },
  { id: 'propuestas', titulo: 'Propuestas' },
] as const;

export default async function PaginaLinks({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver } = await searchParams;
  const activa = PESTANAS.find((p) => p.id === ver)?.id ?? 'accionadores';

  return (
    <>
      <Encabezado pagina={buscarPagina('links')!} />
      <nav aria-label="Pestañas" className="flex gap-1 border-b border-linea">
        {PESTANAS.map((p) => (
          <Link key={p.id} href={`/links?ver=${p.id}`} aria-current={p.id === activa ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[14px] no-underline transition-colors ${
              p.id === activa ? 'border-tinta font-semibold text-tinta' : 'border-transparent text-suave hover:text-tinta'
            }`}>
            {p.titulo}
          </Link>
        ))}
      </nav>
      {activa === 'propuestas' ? <ListaPropuestas /> : <ListaAccionadores />}
    </>
  );
}
