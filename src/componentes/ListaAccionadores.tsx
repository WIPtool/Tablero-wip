import { Tarjeta, Rejilla } from '@/componentes/Bloques';
import { BotonCopiar } from '@/componentes/BotonCopiar';
import { BotonEliminar } from '@/componentes/BotonEliminar';
import { FormularioAccionador } from '@/componentes/FormularioAccionador';
import { eliminarAccionador } from '@/app/(tablero)/links/acciones';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { type Accionador } from '@/lib/datos';

// Pestaña "Accionadores" de Links de interés: enlaces medidos, eventos y datos que suman información en Analytics.
async function leerAccionadores(): Promise<Accionador[]> {
  if (MODO_EJEMPLO) {
    return [{ id: 1, plataforma: 'Instagram', tipo: 'Enlace medido', accionador: 'Instagram (bio y publicaciones)', enlace: 'https://www.wiptool.com/ig',
      que_hace: 'Lleva a la portada y marca la visita como Instagram.', donde_se_ve: 'Resumen › De dónde llegan las visitas.',
      donde_se_usa: 'Bio de Instagram', actualizado_por: 'carga inicial', actualizado: '2026-09-30T00:00:00Z' }];
  }
  const { data, error } = await (await clienteServidor()).from('accionadores').select('*').order('plataforma').order('accionador');
  if (error) throw new Error(error.message);
  return (data ?? []) as Accionador[];
}

export async function ListaAccionadores() {
  const lista = await leerAccionadores();
  const grupos = new Map<string, Accionador[]>();
  for (const a of lista) grupos.set(a.plataforma, [...(grupos.get(a.plataforma) ?? []), a]);
  const tipos = [...new Set(lista.map((a) => a.tipo))];

  return (
    <>
      <nav aria-label="Plataformas" className="flex flex-wrap gap-2 text-[12.5px]">
        {[...grupos.keys()].map((p) => (
          <a key={p} href={`#${encodeURIComponent(p)}`} className="rounded-full border border-linea bg-superficie px-3 py-1 text-suave no-underline hover:text-tinta">
            {p} <span className="text-tenue">{grupos.get(p)!.length}</span>
          </a>
        ))}
      </nav>
      <Rejilla>
        {[...grupos.entries()].map(([plataforma, items]) => (
          <div key={plataforma} id={encodeURIComponent(plataforma)} className="scroll-mt-4 lg:col-span-12">
            <Tarjeta titulo={plataforma}>
              <ul className="flex flex-col">
                {items.map((a) => (
                  <li key={a.id} className="flex flex-col gap-1.5 border-b border-reja py-3 first:pt-0 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <strong className="font-semibold">{a.accionador}</strong>
                        <span className="rounded-full border border-linea px-2 text-[11px] text-suave">{a.tipo}</span>
                      </div>
                      <BotonEliminar accion={eliminarAccionador} id={a.id} pregunta={`¿Eliminar "${a.accionador}" de la lista? El enlace sigue funcionando; solo se quita de esta referencia.`} />
                    </div>
                    {a.enlace && (
                      <div className="flex min-w-0 items-center gap-2">
                        <a href={a.enlace} target="_blank" rel="noopener noreferrer" className="enlace-tabla min-w-0 truncate text-[13px]">{a.enlace.replace(/^https:\/\//, '')}</a>
                        <BotonCopiar texto={a.enlace} />
                      </div>
                    )}
                    {a.que_hace && <p className="max-w-[90ch] text-[13px]">{a.que_hace}</p>}
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] text-suave md:grid-cols-2">
                      {a.donde_se_usa && <div><dt className="inline font-medium text-tinta">Dónde se pone: </dt><dd className="inline">{a.donde_se_usa}</dd></div>}
                      {a.donde_se_ve && <div><dt className="inline font-medium text-tinta">Dónde se ve: </dt><dd className="inline">{a.donde_se_ve}</dd></div>}
                    </dl>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          </div>
        ))}
        <Tarjeta titulo="Agregar un accionador" nota="Cuando se cree un enlace o un evento nuevo en el sitio, agrégalo aquí para que el equipo sepa cómo usarlo.">
          <FormularioAccionador plataformas={[...grupos.keys()]} tipos={tipos} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
