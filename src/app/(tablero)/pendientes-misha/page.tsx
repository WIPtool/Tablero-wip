import type { Metadata } from 'next';
import Link from 'next/link';
import { Encabezado, Tarjeta } from '@/componentes/Bloques';
import { AccionesPendiente } from '@/componentes/AccionesPendiente';
import { Plegable } from '@/componentes/Plegable';
import { cambiarEstado } from './acciones';
import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { buscarPagina } from '@/lib/paginas';
import { type EstadoPendiente, type PendienteMisha } from '@/lib/datos';

export const metadata: Metadata = { title: 'Pendientes Misha' };

// Vistas: Pendientes (nuevos y con una acción pedida, la de entrada), Hechos (?ver=hechos) y Descartados (?ver=descartados).
const VISTAS: { id: string; titulo: string; estados: EstadoPendiente[]; vacio: string }[] = [
  { id: 'pendientes', titulo: 'Pendientes', estados: ['nuevo', 'accion'], vacio: 'No hay correos pendientes. Cuando Claude encuentre uno que le pida algo a Misha, aparece aquí.' },
  { id: 'hechos', titulo: 'Hechos', estados: ['hecho'], vacio: 'Todavía no hay pendientes marcados como hechos.' },
  { id: 'descartados', titulo: 'Descartados', estados: ['descartado'], vacio: 'Todavía no hay pendientes descartados.' },
];
const PRIORIDAD: Record<string, { orden: number; texto: string; clase: string; borde: string }> = {
  alta: { orden: 0, texto: 'Alta', clase: 'border-malo/50 text-malo', borde: 'border-l-malo' },
  media: { orden: 1, texto: 'Media', clase: 'border-aviso text-aviso', borde: 'border-l-aviso' },
  baja: { orden: 2, texto: 'Baja', clase: 'border-linea text-suave', borde: 'border-l-linea' },
};
// Orden de las tarjetas (?orden=fecha): por prioridad (la de entrada) o solo por fecha de solicitud, de la más reciente a la más antigua.
const ORDENES = [{ id: 'prioridad', texto: 'Prioridad' }, { id: 'fecha', texto: 'Fecha de solicitud' }] as const;
const LIMITE = 200;
const boton = 'rounded-lg border border-linea px-2.5 py-1 text-[12.5px] text-suave hover:border-tenue hover:text-tinta';
const fechaHora = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' });
const cuando = (iso: string) => fechaHora.format(new Date(iso)).replace(' de ', ' ');
// Fecha de solicitud: la del correo; los pendientes sin correo usan la fecha en que se agregaron.
const solicitud = (p: PendienteMisha) => p.fecha_correo ?? p.creado;
const enlace = (ver: string, orden: string) => {
  const q = [ver !== 'pendientes' && `ver=${ver}`, orden !== 'prioridad' && `orden=${orden}`].filter(Boolean).join('&');
  return '/pendientes-misha' + (q ? '?' + q : '');
};

const chip = (activo: boolean) =>
  `rounded-full border px-3 py-1 text-[13px] font-medium no-underline ${activo ? 'border-navy bg-navy text-white dark:border-lima dark:bg-lima dark:text-navy' : 'border-linea text-tinta hover:border-tenue'}`;

async function leerPendientes(estados: EstadoPendiente[], porFecha: boolean): Promise<{ lista: PendienteMisha[]; cuentas: Record<string, number> }> {
  let lista: PendienteMisha[];
  let conEstado: { estado: string }[];
  if (MODO_EJEMPLO) {
    const base = { remitente: '', correo_url: 'https://mail.google.com/mail/u/0/#inbox', instruccion: '', respuesta: '', instruccion_atendida: false,
      creado: '2026-10-28T12:00:00Z', actualizado: '2026-10-28T12:00:00Z' };
    const todos: PendienteMisha[] = [
      { ...base, id: 1, correo_id: 'ej1', titulo: 'Asisya pide la propuesta firmada antes del viernes', remitente: 'Laura Gómez <laura@asisya.com>',
        resumen: 'Necesitan la propuesta con la firma de WIP para pasarla a comité el viernes. Preguntan si el precio incluye la integración.',
        fecha_correo: '2026-10-28T15:20:00Z', prioridad: 'alta', estado: 'nuevo' },
      { ...base, id: 2, correo_id: 'ej2', titulo: 'Renovación del dominio wiptool.com', remitente: 'Route 53 <no-reply@aws.amazon.com>',
        resumen: 'El dominio se renueva solo el 12 de noviembre con la tarjeta registrada.', fecha_correo: '2026-10-27T09:00:00Z', prioridad: 'baja', estado: 'nuevo' },
      { ...base, id: 3, correo_id: 'ej3', titulo: 'Fixit quiere mover la reunión de seguimiento', remitente: 'Carlos Ruiz <carlos@fixit.co>',
        resumen: 'Proponen pasar la reunión del martes al miércoles en la tarde.', fecha_correo: '2026-10-27T18:40:00Z', prioridad: 'media', estado: 'accion',
        instruccion: 'Respóndele que sí, el miércoles a las 3 p. m., y manda la invitación.', instruccion_atendida: true,
        respuesta: 'Le respondí a Carlos confirmando el miércoles 29 a las 3 p. m. y le envié la invitación de Calendar.' },
    ];
    lista = todos.filter((p) => estados.includes(p.estado));
    conEstado = todos;
  } else {
    const supabase = await clienteServidor();
    // Las tarjetas de la vista (del correo más reciente al más antiguo) y, aparte, solo el estado de todas para los contadores.
    const [filas, estadosTodos] = await Promise.all([
      supabase.from('pendientes_misha').select('*').in('estado', estados)
        .order('fecha_correo', { ascending: false, nullsFirst: false }).order('creado', { ascending: false }).limit(LIMITE),
      supabase.from('pendientes_misha').select('estado'),
    ]);
    if (filas.error) throw new Error(filas.error.message);
    if (estadosTodos.error) throw new Error(estadosTodos.error.message);
    lista = (filas.data ?? []) as PendienteMisha[];
    conEstado = estadosTodos.data ?? [];
  }
  const cuentas: Record<string, number> = {};
  for (const p of conEstado) cuentas[p.estado] = (cuentas[p.estado] ?? 0) + 1;
  // Por prioridad y, dentro de cada una, de la solicitud más reciente a la más antigua; o solo por fecha.
  const porSolicitud = (a: PendienteMisha, b: PendienteMisha) => Date.parse(solicitud(b)) - Date.parse(solicitud(a));
  lista.sort(porFecha ? porSolicitud
    : (a, b) => (PRIORIDAD[a.prioridad]?.orden ?? 9) - (PRIORIDAD[b.prioridad]?.orden ?? 9) || porSolicitud(a, b));
  return { lista, cuentas };
}

function BotonEstado({ id, estado, texto, clase = boton }: { id: number; estado: EstadoPendiente; texto: string; clase?: string }) {
  return (
    <form action={cambiarEstado}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="estado" value={estado} />
      <button type="submit" className={clase}>{texto}</button>
    </form>
  );
}

function Pendiente({ p }: { p: PendienteMisha }) {
  const prioridad = PRIORIDAD[p.prioridad] ?? PRIORIDAD.media;
  const abierto = p.estado === 'nuevo' || p.estado === 'accion';
  return (
    <article className={`flex min-w-0 flex-col gap-2.5 rounded-tarjeta border border-l-4 border-linea bg-superficie px-[18px] py-4 shadow-tarjeta ${prioridad.borde}`}>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold ${prioridad.clase}`}>{prioridad.texto}</span>
          <time dateTime={solicitud(p)} title="Fecha de solicitud" className="whitespace-nowrap text-[12.5px] tabular-nums text-suave">{cuando(solicitud(p))}</time>
          {p.estado === 'accion' && <span className="inline-block whitespace-nowrap rounded-full border border-serie-1/50 px-2 py-0.5 text-[11.5px] font-semibold text-serie-1">Acción pedida</span>}
          <h2 className="min-w-0 text-base font-bold">{p.titulo}</h2>
        </div>
        {(p.remitente || /^https:\/\//.test(p.correo_url)) && (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px] text-suave">
            {p.remitente && <span className="min-w-0 truncate">{p.remitente}</span>}
            {/^https:\/\//.test(p.correo_url) && (
              <a href={p.correo_url} target="_blank" rel="noopener noreferrer" className="enlace-tabla">Abrir en Gmail</a>
            )}
          </div>
        )}
      </header>
      {(p.resumen || p.instruccion || p.respuesta) && (
        <Plegable id={`contenido-${p.id}`}>
          {p.resumen && <p className="max-w-[90ch] whitespace-pre-line text-[13px]">{p.resumen}</p>}
          {p.instruccion && (
            <div className="max-w-[90ch] rounded-[10px] bg-superficie-2 px-3 py-2 text-[13px]">
              <div className="mb-0.5 flex flex-wrap items-baseline gap-2 text-[12px]">
                <span className="font-medium text-suave">Instrucción para Claude</span>
                <span className={p.instruccion_atendida ? 'text-bueno' : 'text-aviso'}>{p.instruccion_atendida ? 'Atendida' : 'Esperando a Claude'}</span>
              </div>
              <p className="whitespace-pre-line">{p.instruccion}</p>
            </div>
          )}
          {p.respuesta && (
            <div className="max-w-[90ch] rounded-[10px] border border-l-4 border-linea border-l-lima-tinta px-3 py-2 text-[13px]">
              <div className="mb-0.5 text-[12px] font-medium text-suave">Respuesta de Claude</div>
              <p className="whitespace-pre-line">{p.respuesta}</p>
            </div>
          )}
        </Plegable>
      )}
      {abierto ? (
        <AccionesPendiente id={p.id} instruccion={p.instruccion_atendida ? '' : p.instruccion}>
          <BotonEstado id={p.id} estado="hecho" texto="Hecho" clase={`${boton} hover:border-bueno hover:text-bueno`} />
          <BotonEstado id={p.id} estado="descartado" texto="Descartar" />
        </AccionesPendiente>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <BotonEstado id={p.id} estado={p.instruccion && !p.instruccion_atendida ? 'accion' : 'nuevo'} texto="Volver a pendientes" />
        </div>
      )}
    </article>
  );
}

export default async function PaginaPendientesMisha({ searchParams }: { searchParams: Promise<{ ver?: string; orden?: string }> }) {
  const { ver, orden: ordenPedido } = await searchParams;
  const vista = VISTAS.find((v) => v.id === ver) ?? VISTAS[0];
  const orden = ORDENES.find((o) => o.id === ordenPedido) ?? ORDENES[0];
  const { lista, cuentas } = await leerPendientes(vista.estados, orden.id === 'fecha');

  return (
    <>
      <div className="flex flex-col gap-3">
        <Encabezado pagina={buscarPagina('pendientes-misha')!} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Filtro" className="flex flex-wrap gap-1.5">
            {VISTAS.map((v) => {
              const n = v.estados.reduce((s, e) => s + (cuentas[e] ?? 0), 0);
              return (
                <Link key={v.id} href={enlace(v.id, orden.id)}
                  aria-current={v.id === vista.id ? 'true' : undefined} className={chip(v.id === vista.id)}>
                  {v.titulo} <span className="tabular-nums opacity-70">{n}</span>
                </Link>
              );
            })}
          </nav>
          <nav aria-label="Ordenar por" className="flex items-center gap-2">
            <span className="text-[12.5px] text-suave">Ordenar por</span>
            <div className="flex gap-0.5 rounded-[10px] border border-linea bg-superficie p-[3px]">
              {ORDENES.map((o) => (
                <Link key={o.id} href={enlace(vista.id, o.id)} aria-current={o.id === orden.id ? 'true' : undefined}
                  className={`whitespace-nowrap rounded-[7px] px-2.5 py-1 text-[13px] font-medium no-underline transition-colors ${
                    o.id === orden.id ? 'bg-tinta text-fondo' : 'text-suave hover:text-tinta'
                  }`}>
                  {o.texto}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </div>
      {lista.length ? (
        <ul className="flex flex-col gap-3">
          {lista.map((p) => <li key={p.id}><Pendiente p={p} /></li>)}
        </ul>
      ) : (
        <Tarjeta titulo={vista.titulo}><p className="text-[13px] text-suave">{vista.vacio}</p></Tarjeta>
      )}
    </>
  );
}
