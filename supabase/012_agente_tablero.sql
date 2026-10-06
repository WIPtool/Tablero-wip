-- Página "Agente de WhatsApp" del tablero: conversaciones que atendió el agente (F7, flujo F16 de n8n), sus respuestas,
-- los traspasos a una persona y cuántas de esas oportunidades llegaron a una reunión agendada.

-- El agente marca en su respuesta si pasó la conversación a una persona.
alter table agente_mensajes add column if not exists traspaso boolean not null default false;
-- La prueba del 5 de octubre (oportunidad 2783608) pasó a una persona antes de que existiera la columna.
update agente_mensajes set traspaso = true where lead_id = 2783608 and rol = 'agente' and texto like 'Claro, con gusto. Un asesor%';

create or replace function tablero_agente(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  o_agendada int := (select orden from kommo_etapa where nombre ilike 'reuni%n agendada' limit 1);
begin
  perform exigir_equipo();
  return (
    with m as (
      select lead_id, rol, texto, traspaso, momento, (momento at time zone 'America/Bogota')::date as dia
        from agente_mensajes where (momento at time zone 'America/Bogota')::date between a_desde and p_hasta
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
    k as (
      select
        count(distinct lead_id) filter (where rol = 'cliente' and dia >= p_desde) as conversaciones,
        count(distinct lead_id) filter (where rol = 'cliente' and dia < p_desde) as conversaciones_ant,
        count(*) filter (where rol = 'cliente' and dia >= p_desde) as recibidos,
        count(*) filter (where rol = 'cliente' and dia < p_desde) as recibidos_ant,
        count(*) filter (where rol = 'agente' and dia >= p_desde) as respuestas,
        count(*) filter (where rol = 'agente' and dia < p_desde) as respuestas_ant
      from m
    )
    select jsonb_build_object(
      'kpis', (select jsonb_build_object(
          'conversaciones', k.conversaciones, 'conversaciones_ant', k.conversaciones_ant,
          'recibidos', k.recibidos, 'recibidos_ant', k.recibidos_ant,
          'respuestas', k.respuestas, 'respuestas_ant', k.respuestas_ant,
          'atendidas', (select count(*) from atendidas where dia >= p_desde),
          'atendidas_ant', (select count(*) from atendidas where dia < p_desde),
          'traspasos', (select count(*) from atendidas where dia >= p_desde and traspaso),
          'traspasos_ant', (select count(*) from atendidas where dia < p_desde and traspaso),
          'reuniones', (select count(*) from atendidas where dia >= p_desde and reunion),
          'reuniones_ant', (select count(*) from atendidas where dia < p_desde and reunion)) from k),
      'serie', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', d.dia::date, 'conversaciones', coalesce(x.conversaciones, 0), 'respuestas', coalesce(x.respuestas, 0)) order by d.dia)
          from generate_series(p_desde, p_hasta, interval '1 day') as d(dia)
          left join (select dia, count(distinct lead_id) filter (where rol = 'cliente') conversaciones, count(*) filter (where rol = 'agente') respuestas
                       from m group by dia) x on x.dia = d.dia::date), '[]'::jsonb),
      'conversaciones', coalesce((
        select jsonb_agg(c order by c->>'ultimo' desc) from (
          select jsonb_build_object(
            'lead_id', m.lead_id,
            'nombre', coalesce(nullif(l.nombre, ''), 'Oportunidad ' || m.lead_id),
            'origen', origen_kommo(l.origen, l.utm_source),
            'etapa', coalesce(etapa_tablero(e.nombre, e.tipo), '—'),
            'recibidos', count(*) filter (where m.rol = 'cliente'),
            'respuestas', count(*) filter (where m.rol = 'agente'),
            'traspaso', case when bool_or(m.traspaso) then 'Sí' else 'No' end,
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
revoke all on function tablero_agente(date, date) from anon;
