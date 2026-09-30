import { pedir, type Carga } from '@/lib/datos';
import { haceCuanto, horasDesde } from '@/lib/formato';

const FUENTES: Record<string, string> = {
  ga4: 'Google Analytics', gsc: 'Search Console', meta: 'Meta Ads', gads: 'Google Ads', brevo: 'Brevo', explee: 'Explee', kommo: 'Kommo',
};

// Hace cuánto se cargó cada fuente. Verde: al día; ámbar: atrasada; rojo: la última carga falló.
export async function EstadoDatos() {
  let cargas: Carga[] = [];
  try {
    cargas = await pedir<Carga[]>('tablero_estado');
  } catch {
    return <Punto color="bg-malo" texto="No se pudo leer el estado" />;
  }
  if (!cargas.length) return <Punto color="bg-aviso" texto="Aún no hay cargas de datos" />;
  return (
    <div className="flex flex-col gap-1">
      {cargas.map((c) => {
        const horas = horasDesde(c.actualizado);
        const limite = c.fuente === 'gsc' || c.fuente === 'gads' ? 30 : 3;
        const color = c.estado === 'error' ? 'bg-malo' : horas > limite ? 'bg-aviso' : 'bg-bueno';
        const titulo = c.estado === 'error' ? `Error en la última carga: ${c.mensaje}` : `${c.filas} filas en la última carga`;
        return <Punto key={c.fuente} color={color} texto={`${FUENTES[c.fuente] ?? c.fuente} · ${haceCuanto(c.actualizado)}`} titulo={titulo} />;
      })}
    </div>
  );
}

function Punto({ color, texto, titulo }: { color: string; texto: string; titulo?: string }) {
  return (
    <span title={titulo} className="inline-flex items-center gap-1.5 text-xs text-lateral-suave">
      <span className={`size-2 flex-none rounded-full ${color}`} aria-hidden />
      {texto}
    </span>
  );
}
