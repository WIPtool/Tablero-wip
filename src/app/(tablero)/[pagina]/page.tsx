import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Encabezado, Tarjeta } from '@/componentes/Bloques';
import { PROXIMAS } from '@/lib/paginas';

// Páginas de las próximas etapas (T2 a T4): qué traerán, mientras siguen en Data Studio.
export const dynamicParams = false;
export const generateStaticParams = () => PROXIMAS.map((p) => ({ pagina: p.id }));

export async function generateMetadata({ params }: { params: Promise<{ pagina: string }> }): Promise<Metadata> {
  const { pagina } = await params;
  return { title: PROXIMAS.find((x) => x.id === pagina)?.titulo };
}

export default async function Proxima({ params }: { params: Promise<{ pagina: string }> }) {
  const { pagina } = await params;
  const p = PROXIMAS.find((x) => x.id === pagina);
  if (!p) notFound();
  return (
    <>
      <Encabezado pagina={p} />
      <div className="max-w-[62ch]">
        <Tarjeta titulo={`Llega en ${p.etapa}`}>
          <p>{p.sub}.</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">{p.puntos?.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="text-[12.5px] text-suave">Mientras tanto, esta información sigue en Data Studio.</p>
        </Tarjeta>
      </div>
    </>
  );
}
