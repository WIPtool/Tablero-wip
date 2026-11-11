import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso, type Cifra } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { SelectorPeriodo } from '@/componentes/SelectorPeriodo';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Descargas } from '@/lib/datos';
import { fechaLarga, mesLargo } from '@/lib/formato';
import { anterior, describir, leerRango, paramsPeriodo, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Descargas de la app' };

// Descargas de la app WIP en Google Play y App Store, con el selector de periodo de Marketing. Las tiendas publican sus
// cifras con 1 a 3 días de retraso, así que los últimos días del periodo pueden verse en cero.
export default async function PaginaDescargas({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Descargas>('tablero_descargas', paramsPeriodo(rango));
  const k = d.kpis, t = d.totales;
  // Android trae sus contadores acumulados en los informes de Play; mientras no lleguen, la cifra queda pendiente.
  const sinAndroid = t.android === null ? 'Esperando a Google Play' : null;
  // iOS no tiene instalaciones activas: se usan los dispositivos con al menos una sesión en el último mes completo, de la API
  // de analíticas de Apple (solo quienes comparten analíticas).
  const sinIos = t.ios_activos === null ? 'Esperando a Apple' : null;
  const notaIos = t.ios_activos_mes ? `Dispositivos con uso en ${mesLargo(t.ios_activos_mes)} (solo quienes comparten analíticas)` : undefined;
  const cifraTotal = (etiqueta: string, valor: number | null, pendiente: string | null, nota?: string): Cifra =>
    pendiente ? { etiqueta, pendiente, nota } : { etiqueta, valor, nota: nota ?? (etiqueta.includes('Android') && t.android_fecha ? `Al ${fechaLarga(t.android_fecha)}` : undefined) };
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
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">Desde el lanzamiento (no depende del periodo)</h2>
      <Cifras items={[
        cifraTotal('Descargas totales · Android', t.android, sinAndroid),
        cifraTotal('Descargas totales · iOS', t.ios, null),
        cifraTotal('Descargas totales · Ambas', t.android === null ? null : t.android + t.ios, sinAndroid),
        cifraTotal('Activas · Android', t.android_activos, sinAndroid),
        cifraTotal('Activas · iOS', t.ios_activos, sinIos, notaIos),
        cifraTotal('Activas · Ambas', t.android_activos === null || t.ios_activos === null ? null : t.android_activos + t.ios_activos,
          sinAndroid ?? sinIos, 'Suma de las dos medidas de arriba'),
      ]} />
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-suave">En el periodo</h2>
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
