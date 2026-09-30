import type { Metadata } from 'next';
import { Encabezado, Rejilla, Tarjeta } from '@/componentes/Bloques';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Sitio } from '@/lib/datos';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Sitio web' };

export default async function PaginaSitio({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Sitio>('tablero_sitio', { p_desde: rango.desde, p_hasta: rango.hasta });

  return (
    <>
      <Encabezado pagina={buscarPagina('sitio')!} rango={rango} />
      <Rejilla>
        <Tarjeta titulo="Páginas por las que entra la gente" col={7}
          nota="“(not set)” son clics de enlaces medidos que no abren una página del sitio.">
          <Tabla limite={12} filas={d.paginas} columnas={[
            { campo: 'pagina', etiqueta: 'Página de entrada', tipo: 'ruta-sitio' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Celular o computador" col={5}>
          <Tabla total filas={d.dispositivos} columnas={[
            { campo: 'dispositivo', etiqueta: 'Dispositivo' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Países" col={5}>
          <Tabla filas={d.paises} columnas={[
            { campo: 'pais', etiqueta: 'País' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Grabaciones y mapas de calor" col={7}>
          <p className="text-[12.5px] text-suave">
            Para ver cómo usa la gente cada página (dónde hace clic, hasta dónde baja), abre Microsoft Clarity.
          </p>
          <a href="https://clarity.microsoft.com/projects/view/ync4pxhjqu/dashboard" target="_blank" rel="noopener"
            className="self-start rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave no-underline hover:border-tenue hover:text-tinta">
            Abrir Clarity ↗
          </a>
        </Tarjeta>
      </Rejilla>
    </>
  );
}
