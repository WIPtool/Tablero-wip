import type { Metadata } from 'next';
import { Encabezado, Tarjeta, Rejilla } from '@/componentes/Bloques';
import { FormularioCosto } from '@/componentes/FormularioCosto';
import { terminarCosto, eliminarCosto } from './acciones';
import { BotonEliminar } from '@/componentes/BotonEliminar';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { type CostoFijo } from '@/lib/datos';
import { buscarPagina } from '@/lib/paginas';
import { fechaLarga, num } from '@/lib/formato';
import { hoyBogota } from '@/lib/rango';

export const metadata: Metadata = { title: 'Costos fijos' };

async function leerCostos(): Promise<CostoFijo[]> {
  if (MODO_EJEMPLO) {
    return [{ id: 1, plataforma: 'Brevo', monto: 17, moneda: 'USD', desde: '2026-07-02', hasta: null, nota: 'Plan Starter',
      actualizado_por: 'carga inicial', actualizado: '2026-09-30T00:00:00Z' }];
  }
  const { data, error } = await (await clienteServidor()).from('costos_fijos').select('*').order('hasta', { nullsFirst: true }).order('plataforma');
  if (error) throw new Error(error.message);
  return (data ?? []) as CostoFijo[];
}

export default async function PaginaCostos() {
  const costos = await leerCostos();
  const hoy = hoyBogota();
  const activos = costos.filter((c) => !c.hasta || c.hasta >= hoy);
  const terminados = costos.filter((c) => c.hasta && c.hasta < hoy);
  const boton = 'rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-tenue hover:text-tinta';

  const fila = (c: CostoFijo, activo: boolean) => (
    <tr key={c.id} className="border-b border-reja last:border-0">
      <td className="px-2 py-2 font-medium">{c.plataforma}{c.nota && <span className="block text-[12px] font-normal text-suave">{c.nota}</span>}</td>
      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{c.moneda === 'USD' ? `USD ${num(c.monto)}` : `$ ${num(c.monto)}`}</td>
      <td className="whitespace-nowrap px-2 py-2">{fechaLarga(c.desde)}</td>
      <td className="whitespace-nowrap px-2 py-2">{c.hasta ? fechaLarga(c.hasta) : 'Sigue activo'}</td>
      <td className="px-2 py-2 text-[12px] text-suave">{c.actualizado_por}</td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap justify-end gap-2">
          {activo && !c.hasta && (
            <form action={terminarCosto}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="hasta" value={hoy} />
              <button type="submit" className={boton} title="Deja de sumar a la inversión a partir de mañana">Terminar hoy</button>
            </form>
          )}
          <BotonEliminar accion={eliminarCosto} id={c.id} titulo="Lo borra también de los meses anteriores"
            pregunta={`¿Eliminar ${c.plataforma}? Se quita de la inversión de todos los meses. Si solo dejaron de pagarlo, usa "Terminar hoy".`} />
        </div>
      </td>
    </tr>
  );

  const tabla = (lista: CostoFijo[], activo: boolean, vacio: string) => (
    <div className="-mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left text-xs text-suave">
            {['Plataforma', 'Costo mensual', 'Desde', 'Hasta', 'Actualizó', ''].map((t, i) => (
              <th key={i} className={`border-b border-linea px-2 py-1.5 font-medium ${i === 1 ? 'text-right' : ''}`}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lista.length ? lista.map((c) => fila(c, activo)) : <tr><td colSpan={6} className="px-2 py-5 text-center text-tenue">{vacio}</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <Encabezado pagina={buscarPagina('costos')!} />
      <Rejilla>
        <Tarjeta titulo="Costos activos" nota="Cada costo mensual se reparte por día y se suma a la inversión total. Lo que está en dólares se pasa a pesos con la TRM del día.">
          {tabla(activos, true, 'No hay costos fijos activos.')}
        </Tarjeta>
        <Tarjeta titulo="Agregar un costo fijo">
          <FormularioCosto hoy={hoy} />
        </Tarjeta>
        {terminados.length > 0 && (
          <Tarjeta titulo="Costos terminados" nota="Siguen sumando en los meses en que estuvieron activos.">
            {tabla(terminados, false, '')}
          </Tarjeta>
        )}
      </Rejilla>
    </>
  );
}
