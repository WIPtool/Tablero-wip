import { SelectorPeriodo } from '@/componentes/SelectorPeriodo';
import { anterior, describir, type Rango } from '@/lib/rango';
import { cambio, num } from '@/lib/formato';
import type { Pagina } from '@/lib/paginas';

// Título de la página, selector de periodo y con qué se compara.
export function Encabezado({ pagina, rango }: { pagina: Pagina; rango?: Rango }) {
  return (
    <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[23px] font-black md:text-[28px]">{pagina.titulo}</h1>
        <span className="text-[13px] text-suave">{pagina.sub}</span>
      </div>
      {rango && (
        <div className="flex min-w-0 flex-col gap-1.5 md:items-end">
          <SelectorPeriodo rango={rango} />
          <span className="text-xs text-suave">{describir(rango)} · comparado con {describir(anterior(rango))}</span>
        </div>
      )}
    </div>
  );
}

export interface Cifra {
  etiqueta: string;
  valor?: number | null;
  anterior?: number | null;
  formato?: (v: number | null | undefined) => string;
  menorEsMejor?: boolean;
  principal?: boolean;
  pendiente?: string;
  nota?: string;
}

// Fila de cifras. La "principal" encabeza la página (solo una por página).
export function Cifras({ items }: { items: Cifra[] }) {
  return (
    <section aria-label="Cifras del periodo" className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
      {items.map((c) => {
        const base = 'flex min-w-0 flex-col gap-1.5 rounded-tarjeta border px-[18px] py-4 shadow-tarjeta';
        if (c.pendiente) {
          return (
            <div key={c.etiqueta} className={`${base} border-linea bg-superficie`}>
              <span className="text-[13px] text-suave">{c.etiqueta}</span>
              <span className="font-display text-[22px] font-bold text-tenue">{c.pendiente}</span>
              {c.nota && <span className="text-[12.5px] text-suave">{c.nota}</span>}
            </div>
          );
        }
        const f = c.formato ?? num;
        const d = cambio(c.valor, c.anterior, { menorEsMejor: c.menorEsMejor });
        const color = d?.clase === 'sube' ? 'text-bueno' : d?.clase === 'baja' ? 'text-malo' : '';
        return (
          <div key={c.etiqueta} className={`${base} ${c.principal ? 'border-navy bg-navy text-white dark:border-linea dark:bg-superficie-2 dark:text-tinta' : 'border-linea bg-superficie'}`}>
            <span className={`text-[13px] ${c.principal ? 'text-white/70 dark:text-suave' : 'text-suave'}`}>{c.etiqueta}</span>
            <span className={`font-display whitespace-nowrap text-[clamp(22px,2.3vw,32px)] font-black leading-[1.1] tracking-[-0.02em] tabular-nums ${c.principal ? 'text-lima' : ''}`}>
              {f(c.valor)}
            </span>
            {d && (
              <span className={`flex flex-wrap items-baseline gap-1.5 text-[12.5px] ${c.principal ? 'text-white/70 dark:text-suave' : 'text-suave'}`}>
                <b className={`font-semibold ${c.principal && d.clase === 'sube' ? 'text-[#7fe0a8] dark:text-bueno' : c.principal && d.clase === 'baja' ? 'text-[#ff9b92] dark:text-malo' : color}`}>{d.texto}</b>
                vs. periodo anterior ({f(c.anterior)})
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}

const COLS: Record<number, string> = { 12: 'lg:col-span-12', 8: 'lg:col-span-8', 7: 'lg:col-span-7', 6: 'lg:col-span-6', 5: 'lg:col-span-5', 4: 'lg:col-span-4' };

export function Rejilla({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">{children}</div>;
}

export function Tarjeta({ titulo, nota, col = 12, children }: { titulo: string; nota?: React.ReactNode; col?: number; children: React.ReactNode }) {
  return (
    <section className={`flex min-w-0 flex-col gap-3 rounded-tarjeta border border-linea bg-superficie px-[18px] pb-3.5 pt-[18px] shadow-tarjeta ${COLS[col]}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">{titulo}</h2>
        {nota && <span className="text-[12.5px] text-suave">{nota}</span>}
      </header>
      {children}
    </section>
  );
}

export function Leyenda({ items }: { items: { etiqueta: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3.5 text-[12.5px] text-suave">
      {items.map((i) => (
        <span key={i.etiqueta} className="inline-flex items-center gap-1.5">
          <i className="inline-block h-[3px] w-3.5 rounded-sm" style={{ background: i.color }} />
          {i.etiqueta}
        </span>
      ))}
    </div>
  );
}

export function Aviso({ children, tono = 'aviso' }: { children: React.ReactNode; tono?: 'aviso' | 'ejemplo' }) {
  return (
    <div className={`rounded-[10px] border border-l-4 border-linea bg-superficie px-3.5 py-2.5 text-[13px] ${tono === 'aviso' ? 'border-l-aviso' : 'border-l-lima-tinta'}`}>
      {children}
    </div>
  );
}
