import Image from 'next/image';
import Link from 'next/link';
import { Suspense } from 'react';
import { Navegacion } from '@/componentes/Navegacion';
import { BotonTema } from '@/componentes/BotonTema';
import { EstadoDatos } from '@/componentes/EstadoDatos';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';

export default async function LayoutTablero({ children }: { children: React.ReactNode }) {
  let email = 'modo de ejemplo';
  if (!MODO_EJEMPLO) {
    const { data } = await (await clienteServidor()).auth.getClaims();
    email = (data?.claims?.email as string | undefined) ?? '';
  }

  const pie = (
    <div className="mt-auto flex flex-col gap-2 px-2.5 text-xs text-lateral-suave">
      <Suspense fallback={<span className="text-xs">Revisando datos…</span>}>
        <EstadoDatos />
      </Suspense>
      <span className="truncate" title={email}>{email}</span>
      <BotonTema />
      {!MODO_EJEMPLO && (
        <form action="/auth/salir" method="post">
          <button type="submit" className="w-full rounded-lg border border-white/15 px-2.5 py-1.5 text-left text-lateral-tinta hover:border-white/40">
            Salir
          </button>
        </form>
      )}
    </div>
  );

  return (
    <div className="grid min-h-full grid-cols-1 md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-10 flex items-center gap-3 bg-lateral px-4 py-2.5 pt-[calc(10px+env(safe-area-inset-top,0px))] text-lateral-tinta md:h-screen md:flex-col md:items-stretch md:gap-5 md:overflow-y-auto md:px-3.5 md:py-5">
        <Link href="/resumen" aria-label="Tablero WIP, inicio" className="flex items-baseline gap-2.5 px-2.5 no-underline">
          <Image src="/img/logo-lima.png" alt="WIP" width={61} height={26} priority className="h-[26px] w-auto" />
          <span className="hidden text-[11px] uppercase tracking-[0.12em] text-lateral-suave md:inline">Tablero</span>
        </Link>
        <Suspense>
          <Navegacion pie={pie} />
        </Suspense>
      </aside>
      <main className="flex min-w-0 flex-col gap-5 px-4 pb-12 pt-5 md:px-7 md:pb-16 md:pt-6">
        {MODO_EJEMPLO && (
          <div className="rounded-[10px] border border-linea border-l-4 border-l-lima-tinta bg-superficie px-3.5 py-2.5 text-[13px]">
            <strong className="font-semibold">Modo de ejemplo.</strong> Cifras inventadas para ver el diseño, sin conexión a la base.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
