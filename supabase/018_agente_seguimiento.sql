-- Agente de seguimiento (2026-10-06): si la persona deja de responder, el agente le escribe una vez más, dentro de la
-- ventana de 24 horas de WhatsApp (pasada esa ventana solo se puede escribir con una plantilla aprobada por Meta).
-- Lo corre F12 cada hora (8 a. m. a 8 p. m., hora Colombia) y escribe aquí lo que envía.

-- tipo de los mensajes del agente: normal (respuesta), seguimiento (lo envió el seguimiento) o sin_seguimiento
-- (Claude decidió no escribir, p. ej. la persona dijo que no le interesa; se guarda para no volver a preguntar).
alter table agente_mensajes add column if not exists tipo text not null default 'normal';
alter table agente_mensajes drop constraint if exists agente_mensajes_tipo_check;
alter table agente_mensajes add constraint agente_mensajes_tipo_check check (tipo in ('normal', 'seguimiento', 'sin_seguimiento'));

-- Conversaciones que esperan seguimiento: la última palabra es del agente hace más de 3 horas, la persona escribió hace
-- menos de 22 horas (queda margen dentro de la ventana de 24 h), y desde su último mensaje no hubo seguimiento ni traspaso.
-- La etapa, las etiquetas y si alguien del equipo escribió desde el celular se revisan en n8n contra Kommo.
create or replace view agente_seguimiento_pendiente with (security_invoker = true) as
with u as (
  select lead_id,
         max(momento) filter (where rol = 'cliente') as ult_cliente,
         max(momento) filter (where rol = 'agente') as ult_agente
    from agente_mensajes
   where momento > now() - interval '3 days'
   group by lead_id
)
select u.lead_id, u.ult_cliente, u.ult_agente,
       (select coalesce(jsonb_agg(jsonb_build_object('rol', h.rol, 'texto', h.texto, 'tipo', h.tipo, 'momento', h.momento) order by h.momento), '[]'::jsonb)
          from (select * from agente_mensajes x where x.lead_id = u.lead_id and x.tipo <> 'sin_seguimiento'
                 order by x.momento desc limit 30) h) as historial
  from u
 where u.ult_agente > u.ult_cliente
   and u.ult_agente < now() - interval '3 hours'
   and u.ult_cliente > now() - interval '22 hours'
   and not exists (select 1 from agente_mensajes s
                    where s.lead_id = u.lead_id and s.rol = 'agente' and s.momento > u.ult_cliente
                      and (s.tipo <> 'normal' or s.traspaso));
revoke all on agente_seguimiento_pendiente from anon, authenticated;

-- Página del agente: las respuestas ya no cuentan los seguimientos; se agregan seguimientos enviados y cuántas
-- conversaciones se reactivaron (la persona volvió a escribir después del seguimiento).
create or replace function tablero_agente(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
  o_agendada int := (select orden from kommo_etapa where nombre ilike 'reuni%n agendada' limit 1);
begin
  perform exigir_equipo();
  return (
    with m as (
      select lead_id, rol, tipo, texto, traspaso, momento, (momento at time zone 'America/Bogota')::date as dia
        from agente_mensajes where (momento at time zone 'America/Bogota')::date between a_desde and p_hasta and tipo <> 'sin_seguimiento'
    ),
    -- Oportunidades que el agente atendió (al menos una respuesta suya), con su etapa y si llegaron a reunión.
    atendidas as (
      select a.lead_id, min(a.dia) as dia, bool_or(a.traspaso) as traspaso,
             coalesce(e.tipo = 'ganada' or (e.tipo <> 'perdida' and e.orden >= o_agendada), false)
             or exists (select 1 from kommo_cambio_etapa c join kommo_etapa ce on ce.etapa_id = c.a_etapa
                         where c.lead_id = a.lead_id and (ce.tipo = 'ganada' or ce.orden >= o_agendada)) as reunion
        from m a
        left join kommo_lead l on l.lead_id = a.lead_id
        left join kommo_etapa e on e.etapa_id = l.etapa_id
       where a.rol = 'agente'
       group by a.lead_id, e.tipo, e.orden
    ),
    -- Seguimientos enviados y si la persona respondió después.
    seg as (
      select s.lead_id, s.dia,
             exists (select 1 from agente_mensajes c where c.lead_id = s.lead_id and c.rol = 'cliente' and c.momento > s.momento) as respondio
        from m s where s.rol = 'agente' and s.tipo = 'seguimiento'
    ),
    k as (
      select
        count(distinct lead_id) filter (where rol = 'cliente' and dia >= p_desde) as conversaciones,
        count(distinct lead_id) filter (where rol = 'cliente' and dia <= a_hasta) as conversaciones_ant,
        count(*) filter (where rol = 'cliente' and dia >= p_desde) as recibidos,
        count(*) filter (where rol = 'cliente' and dia <= a_hasta) as recibidos_ant,
        count(*) filter (where rol = 'agente' and tipo = 'normal' and dia >= p_desde) as respuestas,
        count(*) filter (where rol = 'agente' and tipo = 'normal' and dia <= a_hasta) as respuestas_ant
      from m
    )
    select jsonb_build_object(
      'kpis', (select jsonb_build_object(
          'conversaciones', k.conversaciones, 'conversaciones_ant', k.conversaciones_ant,
          'recibidos', k.recibidos, 'recibidos_ant', k.recibidos_ant,
          'respuestas', k.respuestas, 'respuestas_ant', k.respuestas_ant,
          'atendidas', (select count(*) from atendidas where dia >= p_desde),
          'atendidas_ant', (select count(*) from atendidas where dia <= a_hasta),
          'traspasos', (select count(*) from atendidas where dia >= p_desde and traspaso),
          'traspasos_ant', (select count(*) from atendidas where dia <= a_hasta and traspaso),
          'reuniones', (select count(*) from atendidas where dia >= p_desde and reunion),
          'reuniones_ant', (select count(*) from atendidas where dia <= a_hasta and reunion),
          'seguimientos', (select count(*) from seg where dia >= p_desde),
          'seguimientos_ant', (select count(*) from seg where dia <= a_hasta),
          'reactivadas', (select count(*) from seg where dia >= p_desde and respondio),
          'reactivadas_ant', (select count(*) from seg where dia <= a_hasta and respondio)) from k),
      'serie', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', d.dia::date, 'conversaciones', coalesce(x.conversaciones, 0), 'respuestas', coalesce(x.respuestas, 0),
                                            'seguimientos', coalesce(x.seguimientos, 0)) order by d.dia)
          from generate_series(p_desde, p_hasta, interval '1 day') as d(dia)
          left join (select dia, count(distinct lead_id) filter (where rol = 'cliente') conversaciones,
                            count(*) filter (where rol = 'agente' and tipo = 'normal') respuestas,
                            count(*) filter (where rol = 'agente' and tipo = 'seguimiento') seguimientos
                       from m group by dia) x on x.dia = d.dia::date), '[]'::jsonb),
      'conversaciones', coalesce((
        select jsonb_agg(c order by c->>'ultimo' desc) from (
          select jsonb_build_object(
            'lead_id', m.lead_id,
            'nombre', coalesce(nullif(l.nombre, ''), 'Oportunidad ' || m.lead_id),
            'origen', origen_kommo(l.origen, l.utm_source),
            'etapa', coalesce(etapa_tablero(e.nombre, e.tipo), '—'),
            'recibidos', count(*) filter (where m.rol = 'cliente'),
            'respuestas', count(*) filter (where m.rol = 'agente' and m.tipo = 'normal'),
            'traspaso', case when bool_or(m.traspaso) then 'Sí' else 'No' end,
            'seguimiento', case when not bool_or(m.tipo = 'seguimiento') then 'No'
                                when max(m.momento) filter (where m.rol = 'cliente') > max(m.momento) filter (where m.tipo = 'seguimiento') then 'Respondió'
                                else 'Sin respuesta' end,
            'ultimo_mensaje', (select left(x.texto, 160) from agente_mensajes x where x.lead_id = m.lead_id and x.rol = 'cliente' order by x.momento desc limit 1),
            'ultimo', max(m.momento),
            'kommo', 'https://wiptool.kommo.com/leads/detail/' || m.lead_id) as c
            from m
            left join kommo_lead l on l.lead_id = m.lead_id
            left join kommo_etapa e on e.etapa_id = l.etapa_id
           where m.dia >= p_desde
           group by m.lead_id, l.nombre, l.origen, l.utm_source, e.nombre, e.tipo
           order by max(m.momento) desc
           limit 200) t), '[]'::jsonb),
      'por_origen', coalesce((
        select jsonb_agg(jsonb_build_object('origen', origen, 'atendidas', atendidas, 'reuniones', reuniones, 'traspasos', traspasos) order by atendidas desc)
          from (select origen_kommo(l.origen, l.utm_source) origen, count(*) atendidas, count(*) filter (where a.reunion) reuniones,
                       count(*) filter (where a.traspaso) traspasos
                  from atendidas a left join kommo_lead l on l.lead_id = a.lead_id
                 where a.dia >= p_desde group by 1) o), '[]'::jsonb)
    )
  );
end $$;
revoke all on function tablero_agente(date, date, date) from anon;
