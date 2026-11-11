import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { SelectorPeriodo } from '@/componentes/SelectorPeriodo';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Descargas } from '@/lib/datos';
import { fechaLarga } from '@/lib/formato';
import { anterior, describir, leerRango, paramsPeriodo, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Descargas de la app' };

// Descargas de la app WIP en Google Play y App Store, con el selector de periodo de Marketing. Las tiendas publican sus
// cifras con 1 a 3 días de retraso, así que los últimos días del periodo pueden verse en cero.
export default async function PaginaDescargas({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Descargas>('tablero_descargas', paramsPeriodo(rango));
  const k = d.kpis;
  const ultimo = (tienda: string, f: string | null) => f ? <> {tienda}: datos hasta el {fechaLarga(f)}.</> : <> {tienda}: aún sin datos.</>;

  return (
    <>
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:justify-between md:gap-5">
        <Encabezado pagina={buscarPagina('descargas')!} />
        <div className="flex min-w-0 flex-col gap-1.5 md:items-end">
          <SelectorPeriodo rango={rango} />
          <span className="text-xs text-suave">{describir(rango)} · comparado con {describir(anterior(rango))}</span>
        </div>
      </div>
      <Cifras items={[
        { etiqueta: 'Descargas', valor: k.descargas, anterior: k.descargas_ant, principal: true },
        { etiqueta: 'Android (Google Play)', valor: k.android, anterior: k.android_ant },
        { etiqueta: 'iOS (App Store)', valor: k.ios, anterior: k.ios_ant },
        { etiqueta: 'Descargas por día', valor: k.por_dia, anterior: k.por_dia_ant },
        { etiqueta: 'Actualizaciones', valor: k.actualizaciones, anterior: k.actualizaciones_ant },
        { etiqueta: 'Desinstalaciones (Android)', valor: k.desinstalaciones, anterior: k.desinstalaciones_ant, menorEsMejor: true },
      ]} />
      <Aviso>
        Descargas nuevas de la app WIP según cada tienda (Google Play: instalaciones de usuarios; App Store: unidades descargadas,
        sin contar actualizaciones). Las tiendas publican sus cifras con 1 a 3 días de retraso; se cargan una vez al día.
        {ultimo('Android', d.ultimo_dia.android)}{ultimo('iOS', d.ultimo_dia.ios)}
      </Aviso>
      <Rejilla>
        <Tarjeta titulo="Descargas por día">
          <Leyenda items={[{ etiqueta: 'Android', color: 'var(--serie-1)' }, { etiqueta: 'iOS', color: 'var(--serie-2)' }]} />
          <GraficaPaneles juntos serie={d.serie} alto={200} paneles={[
            { campo: 'android', etiqueta: 'Android', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'ios', etiqueta: 'iOS', forma: 'columnas', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Por tienda" nota="App WIP Colaboradores (Android: com.asiste). Las apps de SBS de la misma cuenta no se cargan">
          <Tabla total filas={d.por_app.map((f) => ({ ...f, tienda: f.tienda === 'ios' ? 'iOS' : 'Android' }))} vacio="Sin descargas en este periodo." columnas={[
            { campo: 'app', etiqueta: 'App' },
            { campo: 'tienda', etiqueta: 'Tienda' },
            { campo: 'descargas', etiqueta: 'Descargas', tipo: 'numero', barra: true },
            { campo: 'descargas_ant', etiqueta: 'Periodo anterior', tipo: 'numero' },
            { campo: 'actualizaciones', etiqueta: 'Actualizaciones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Por país">
          <Tabla total limite={15} filas={d.por_pais} vacio="Sin descargas en este periodo." columnas={[
            { campo: 'pais', etiqueta: 'País' },
            { campo: 'descargas', etiqueta: 'Descargas', tipo: 'numero', barra: true },
            { campo: 'android', etiqueta: 'Android', tipo: 'numero' },
            { campo: 'ios', etiqueta: 'iOS', tipo: 'numero' },
            { campo: 'descargas_ant', etiqueta: 'Periodo anterior', tipo: 'numero' },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
