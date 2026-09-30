import type { Metadata } from 'next';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { BotonGoogle } from '@/componentes/BotonGoogle';
import { MODO_EJEMPLO } from '@/lib/config';

export const metadata: Metadata = { title: 'Entrar' };

export default async function Entrar({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (MODO_EJEMPLO) redirect('/resumen');
  const { error } = await searchParams;
  return (
    <main className="grid min-h-full place-items-center bg-lateral p-6 text-lateral-tinta">
      <div className="flex w-full max-w-[420px] flex-col gap-5">
        <Image src="/img/logo-lima.png" alt="WIP" width={94} height={40} priority className="h-10 w-auto self-start" />
        <h1 className="text-3xl font-black">Tablero de marketing</h1>
        <p className="text-lateral-suave">Entra con tu cuenta de Google de WIP (@wiptool.com).</p>
        {error && (
          <p className="rounded-lg border border-[#f06b60]/40 bg-[#f06b60]/10 px-3 py-2 text-[13px] text-[#ffd9d5]">
            No se pudo entrar: {error}. Si sigue pasando, avisa a quien administra el tablero.
          </p>
        )}
        <BotonGoogle />
      </div>
    </main>
  );
}
