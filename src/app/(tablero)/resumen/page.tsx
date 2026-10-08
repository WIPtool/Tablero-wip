import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Resumen, type Inversion } from '@/lib/datos';
import { pesos } from '@/lib/formato';
import { leerRango, paramsPeriodo, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Resumen' };

// Nombres legibles de los eventos clave de Analytics.
const EVENTOS: Record<string, string> = {
  click_whatsapp: 'Clic a WhatsApp', click_calendly: 'Clic a la agenda', formulario_contacto: 'Formulario de contacto',
  inscripcion_enviada: 'Inscripción a un plan', generate_lead: 'Lead (formulario o ebook)', calendly_agendado: 'Cita agendada',
};

export default async function PaginaResumen({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const params = paramsPeriodo(rango);
  const [d, inv] = await Promise.all([pedir<Resumen>('tablero_resumen', params), pedir<Inversion>('tablero_inversion', params)]);
  const k = d.kpis;

  return (
    <>
      <Encabezado pagina={buscarPagina('resumen')!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Conversiones del sitio', valor: k.conversiones, anterior: k.conversiones_ant, principal: true },
        { etiqueta: 'Visitas al sitio', valor: k.visitas, anterior: k.visitas_ant },
        { etiqueta: 'Clics desde Google', valor: k.clics_google, anterior: k.clics_google_ant },
        { etiqueta: 'Apariciones en Google', valor: k.impresiones, anterior: k.impresiones_ant },
        { etiqueta: 'Total inversión (COP)', valor: inv.total, anterior: inv.total_ant, formato: pesos },
      ]} />
      <Rejilla>
        <Tarjeta titulo="Visitas y conversiones por día">
          <Leyenda items={[{ etiqueta: 'Visitas', color: 'var(--serie-1)' }, { etiqueta: 'Conversiones', color: 'var(--serie-2)' }]} />
          <GraficaPaneles juntos alto={240} serie={d.serie} paneles={[
            { campo: 'visitas', etiqueta: 'Visitas', forma: 'linea', color: 'var(--serie-1)', area: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', forma: 'linea', color: 'var(--serie-2)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="De dónde llegan las visitas" col={7}
          nota="“Directo” son visitas sin origen conocido: enlaces compartidos a mano o escritos en el navegador.">
          <Tabla total filas={d.canales} columnas={[
            { campo: 'canal', etiqueta: 'Canal' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Conversiones por tipo" col={5}>
          <Tabla total filas={d.conversiones_por_tipo.map((t) => ({ nombre: EVENTOS[t.tipo] ?? t.tipo, conversiones: t.conversiones }))} columnas={[
            { campo: 'nombre', etiqueta: 'Tipo' },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero', barra: true },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Clics a WhatsApp y a la agenda por origen" col={7}
          nota="Incluye los enlaces medidos (/wa-ig, /agenda-explee…) y los botones del sitio.">
          <Tabla total filas={d.clics_por_origen} columnas={[
            { campo: 'origen', etiqueta: 'Origen' },
            { campo: 'clic_a', etiqueta: 'Clic a' },
            { campo: 'clics', etiqueta: 'Clics', tipo: 'numero', barra: true },
            { campo: 'personas', etiqueta: 'Personas', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Citas agendadas por origen" col={5}>
          <Tabla total filas={d.citas_por_origen}
            vacio="Aún no hay citas agendadas en este periodo. Se registran cuando alguien termina de agendar en Calendly."
            columnas={[
              { campo: 'origen', etiqueta: 'Origen' },
              { campo: 'citas', etiqueta: 'Citas', tipo: 'numero', barra: true },
              { campo: 'personas', etiqueta: 'Personas', tipo: 'numero' },
            ]} />
        </Tarjeta>
        <Tarjeta titulo="App sin app por cliente" col={6} nota="Visitas desde el mensaje de WhatsApp “experiencia app sin app”.">
          <Tabla filas={d.app_sin_app} columnas={[
            { campo: 'cliente', etiqueta: 'Cliente' },
            { campo: 'visitas', etiqueta: 'Visitas', tipo: 'numero', barra: true },
            { campo: 'conversiones', etiqueta: 'Conversiones', tipo: 'numero' },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
