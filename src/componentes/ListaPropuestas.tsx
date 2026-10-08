import { Tarjeta, Rejilla } from '@/componentes/Bloques';
import { BotonCopiar } from '@/componentes/BotonCopiar';
import { BotonEliminar } from '@/componentes/BotonEliminar';
import { FormularioPropuesta } from '@/componentes/FormularioPropuesta';
import { eliminarPropuesta } from '@/app/(tablero)/links/acciones';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { type Propuesta } from '@/lib/datos';

// Pestaña "Propuestas" de Links de interés: propuestas, informes y documentos enviados a clientes (páginas privadas del sitio).
const ORDEN_TIPOS = ['Propuesta comercial', 'Informe', 'Inversión'];
const fechaCorta = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

async function leerPropuestas(): Promise<Propuesta[]> {
  if (MODO_EJEMPLO) {
    return [
      { id: 1, cliente: 'Asisya', documento: 'Propuesta Asisya', tipo: 'Propuesta comercial', enlace: 'https://www.wiptool.com/cotizaciones/asisya01',
        fecha: '2026-08-28', notas: '', actualizado_por: 'carga inicial', actualizado: '2026-10-07T00:00:00Z' },
      { id: 2, cliente: 'Fixit', documento: 'Informe semestral · WIP IA', tipo: 'Informe', enlace: 'https://www.wiptool.com/informeFixit/WipIA',
        fecha: '2026-09-10', notas: '', actualizado_por: 'carga inicial', actualizado: '2026-10-07T00:00:00Z' },
    ];
  }
  const { data, error } = await (await clienteServidor()).from('propuestas').select('*').order('fecha', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Propuesta[];
}

export async function ListaPropuestas() {
  const lista = await leerPropuestas();
  const grupos = new Map<string, Propuesta[]>();
  for (const p of lista) grupos.set(p.tipo, [...(grupos.get(p.tipo) ?? []), p]);
  const tipos = [...grupos.keys()].sort((a, b) => (ORDEN_TIPOS.indexOf(a) + 1 || 99) - (ORDEN_TIPOS.indexOf(b) + 1 || 99));

  return (
    <Rejilla>
      {tipos.map((tipo) => (
        <div key={tipo} className="lg:col-span-12">
          <Tarjeta titulo={tipo === 'Propuesta comercial' ? 'Propuestas comerciales' : tipo === 'Informe' ? 'Informes' : tipo}>
            <ul className="flex flex-col">
              {grupos.get(tipo)!.map((p) => (
                <li key={p.id} className="flex flex-col gap-1.5 border-b border-reja py-3 first:pt-0 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <strong className="font-semibold">{p.cliente}</strong>
                      <span className="text-[13px] text-suave">{p.documento}</span>
                      {p.fecha && <span className="text-[12px] tabular-nums text-tenue">{fechaCorta.format(new Date(p.fecha))}</span>}
                    </div>
                    <BotonEliminar accion={eliminarPropuesta} id={p.id} pregunta={`¿Quitar "${p.documento}" de ${p.cliente} de la lista? La página sigue publicada; solo se quita de esta referencia.`} />
                  </div>
                  <div className="flex min-w-0 items-center gap-2">
                    <a href={p.enlace} target="_blank" rel="noopener noreferrer" className="enlace-tabla min-w-0 truncate text-[13px]">{p.enlace.replace(/^https:\/\//, '')}</a>
                    <BotonCopiar texto={p.enlace} />
                  </div>
                  {p.notas && <p className="max-w-[90ch] text-[13px]">{p.notas}</p>}
                </li>
              ))}
            </ul>
          </Tarjeta>
        </div>
      ))}
      {!lista.length && <Tarjeta titulo="Propuestas"><p className="text-[13px] text-suave">Todavía no hay propuestas en la lista.</p></Tarjeta>}
      <Tarjeta titulo="Agregar una propuesta" nota="Cuando se publique una propuesta, un informe o un documento nuevo para un cliente, agrégalo aquí para tener todos los enlaces a mano.">
        <FormularioPropuesta tipos={[...new Set([...ORDEN_TIPOS, ...tipos])]} />
      </Tarjeta>
    </Rejilla>
  );
}
