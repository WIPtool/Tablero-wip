import type { Metadata } from 'next';
import { Encabezado, Cifras, Rejilla, Tarjeta, Leyenda, Aviso } from '@/componentes/Bloques';
import { GraficaPaneles } from '@/componentes/GraficaPaneles';
import { Tabla } from '@/componentes/Tabla';
import { pedir, type Agente } from '@/lib/datos';
import { pct } from '@/lib/formato';
import { leerRango, paramsPeriodo, type ParametrosBusqueda } from '@/lib/rango';
import { buscarPagina } from '@/lib/paginas';

export const metadata: Metadata = { title: 'Agente de WhatsApp' };

const tasa = (a?: number | null, b?: number | null) => (b ? (a ?? 0) / b : null);

export default async function PaginaAgente({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  const rango = leerRango(await searchParams);
  const d = await pedir<Agente>('tablero_agente', paramsPeriodo(rango));
  const k = d.kpis;

  return (
    <>
      <Encabezado pagina={buscarPagina('agente')!} rango={rango} />
      <Cifras items={[
        { etiqueta: 'Conversaciones atendidas', valor: k.atendidas, anterior: k.atendidas_ant, principal: true },
        { etiqueta: 'Mensajes recibidos', valor: k.recibidos, anterior: k.recibidos_ant },
        { etiqueta: 'Respuestas del agente', valor: k.respuestas, anterior: k.respuestas_ant },
        { etiqueta: 'Pasadas a una persona', valor: k.traspasos, anterior: k.traspasos_ant, menorEsMejor: true },
        { etiqueta: 'Llegaron a reunión', valor: k.reuniones, anterior: k.reuniones_ant },
        { etiqueta: 'Tasa de reunión', valor: tasa(k.reuniones, k.atendidas), anterior: tasa(k.reuniones_ant, k.atendidas_ant), formato: pct },
        { etiqueta: 'Seguimientos enviados', valor: k.seguimientos, anterior: k.seguimientos_ant },
        { etiqueta: 'Respondieron al seguimiento', valor: k.reactivadas, anterior: k.reactivadas_ant },
      ]} />
      <Aviso>
        El agente responde por WhatsApp, con Claude, a los prospectos en Leads entrantes o Nuevo (flujo F16 de n8n, desde el 5 de octubre de 2026).
        No responde en chats con la etiqueta <strong className="font-semibold">Atender persona</strong> o <strong className="font-semibold">Agente pausado</strong>.
        Tampoco responde si alguien del equipo le escribió a esa persona en las últimas 24 horas (desde Kommo o desde la app de WhatsApp Business del celular).
        Si la persona deja de responder, el agente le escribe un seguimiento a las 3 horas (de 8 a. m. a 8 p. m. y solo dentro de las 24 horas que permite WhatsApp).
        Una conversación cuenta como atendida cuando el agente respondió al menos una vez; llegó a reunión si la oportunidad pasó a Reunión agendada o más adelante.
      </Aviso>
      <Rejilla>
        <Tarjeta titulo="Conversaciones y respuestas por día">
          <Leyenda items={[{ etiqueta: 'Conversaciones con mensajes', color: 'var(--serie-1)' }, { etiqueta: 'Respuestas del agente', color: 'var(--serie-2)' }, { etiqueta: 'Seguimientos', color: 'var(--serie-3)' }]} />
          <GraficaPaneles serie={d.serie} paneles={[
            { campo: 'conversaciones', etiqueta: 'Conversaciones con mensajes', forma: 'columnas', color: 'var(--serie-1)' },
            { campo: 'respuestas', etiqueta: 'Respuestas del agente', forma: 'columnas', color: 'var(--serie-2)' },
            { campo: 'seguimientos', etiqueta: 'Seguimientos', forma: 'columnas', color: 'var(--serie-3)' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Por origen" nota="Conversaciones que atendió el agente, según el Origen de la oportunidad en Kommo.">
          <Tabla total filas={d.por_origen} vacio="El agente no atendió conversaciones en este periodo." columnas={[
            { campo: 'origen', etiqueta: 'Origen' },
            { campo: 'atendidas', etiqueta: 'Atendidas', tipo: 'numero', barra: true },
            { campo: 'reuniones', etiqueta: 'Llegaron a reunión', tipo: 'numero' },
            { campo: 'traspasos', etiqueta: 'Pasadas a una persona', tipo: 'numero' },
          ]} />
        </Tarjeta>
        <Tarjeta titulo="Conversaciones" nota="Las más recientes primero. El enlace abre la oportunidad en Kommo.">
          <Tabla orden="ultimo" limite={20} filas={d.conversaciones} vacio="Sin mensajes de WhatsApp en este periodo." columnas={[
            { campo: 'ultimo', etiqueta: 'Último mensaje', tipo: 'fecha' },
            { campo: 'nombre', etiqueta: 'Oportunidad' },
            { campo: 'origen', etiqueta: 'Origen' },
            { campo: 'etapa', etiqueta: 'Etapa' },
            { campo: 'recibidos', etiqueta: 'Mensajes', tipo: 'numero' },
            { campo: 'respuestas', etiqueta: 'Respuestas', tipo: 'numero' },
            { campo: 'traspaso', etiqueta: 'Pasó a persona' },
            { campo: 'seguimiento', etiqueta: 'Seguimiento' },
            { campo: 'ultimo_mensaje', etiqueta: 'Lo último que escribió' },
            { campo: 'kommo', etiqueta: 'Kommo', tipo: 'enlace' },
          ]} />
        </Tarjeta>
      </Rejilla>
    </>
  );
}
