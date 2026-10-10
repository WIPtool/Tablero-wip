-- Medición del agente de WhatsApp (2026-10-10): además de lo que ya mostraba la página (018), cuántas personas dieron su
-- correo, hasta qué paso del guion llegó cada conversación, cuánto tarda el agente en responder y qué conversaciones
-- quedaron con el último mensaje de la persona sin respuesta.
--
-- Cambio en lo que ya había: una conversación cuenta como atendida solo si el agente le respondió (tipo normal).
-- Antes también contaban las que solo recibieron una plantilla para retomar o un recordatorio de reunión.
--
-- Los pasos del guion se reconocen por frases del guion del agente (n8n/agente-instrucciones.md). Si el guion cambia,
-- hay que cambiar también las frases de agente_paso().

create or replace function agente_paso(p_texto text) returns int
language sql immutable as $$
  select case
    when p_texto ~* '(calendly\.com|wiptool\.com/agenda)' then 6               -- envió el enlace de agenda
    when p_texto ~* 'demo' then 5                                              -- ofreció la demo
    when p_texto ~* 'te cuento' then 4                                         -- explicó WIP según su reto
    when p_texto ~* 'reto m[aá]s grande' then 3                                -- preguntó el reto
    when p_texto ~* '(herramienta para la gesti[oó]n|tecnificas)' then 2       -- preguntó por la herramienta actual
    when p_texto ~* 'tipo de servicio' then 1                                  -- preguntó el tipo de servicio
    else 0 end
$$;

-- Correo escrito por la persona en el chat (cuando lo da, el agente la inscribe en la secuencia de Brevo).
create or replace function agente_tiene_correo(p_texto text) returns boolean
language sql immutable as $$ select p_texto ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' $$;

create or replace function tablero_agente(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
  o_agendada int := (select orden from kommo_etapa where nombre ilike 'reuni%n agendada' limit 1);
  -- Etapas en las que responde el agente: Leads entrantes (Incoming leads), En conversación y Sin respuesta (retomar).
  etapas_agente bigint[] := array[112413247, 112413251, 112730823];
begin
  perform exigir_equipo();
  return (
    with m as (
      select lead_id, rol, tipo, texto, traspaso, momento, (momento at time zone 'America/Bogota')::date as dia
        from agente_mensajes where (momento at time zone 'America/Bogota')::date between a_desde and p_hasta and tipo <> 'sin_seguimiento'
    ),
    -- Oportunidades que el agente atendió (al menos una respuesta suya), con su etapa, si llegaron a reunión,
    -- el paso más avanzado del guion, si la persona siguió la conversación y si dio su correo.
    atendidas as (
      select a.lead_id, min(a.dia) filter (where a.rol = 'agente' and a.tipo = 'normal') as dia,
             bool_or(a.traspaso) as traspaso,
             coalesce(max(agente_paso(a.texto)) filter (where a.rol = 'agente' and a.tipo = 'normal'), 0) as paso,
             count(*) filter (where a.rol = 'cliente') >= 2 as siguio,
             coalesce(bool_or(agente_tiene_correo(a.texto)) filter (where a.rol = 'cliente'), false) as correo,
             coalesce(e.tipo = 'ganada' or (e.tipo <> 'perdida' and e.orden >= o_agendada), false)
             or exists (select 1 from kommo_cambio_etapa c join kommo_etapa ce on ce.etapa_id = c.a_etapa
                         where c.lead_id = a.lead_id and (ce.tipo = 'ganada' or ce.orden >= o_agendada)) as reunion
        from m a
        left join kommo_lead l on l.lead_id = a.lead_id
        left join kommo_etapa e on e.etapa_id = l.etapa_id
       group by a.lead_id, e.tipo, e.orden
      having bool_or(a.rol = 'agente' and a.tipo = 'normal')
    ),
    -- Seguimientos enviados y si la persona respondió después.
    seg as (
      select s.lead_id, s.dia,
             exists (select 1 from agente_mensajes c where c.lead_id = s.lead_id and c.rol = 'cliente' and c.momento > s.momento) as respondio
        from m s where s.rol = 'agente' and s.tipo = 'seguimiento'
    ),
    -- Tiempo de respuesta: de cada mensaje de la persona a la siguiente respuesta del agente (si llegó en menos de 2 horas).
    espera as (
      select c.dia, extract(epoch from (r.momento - c.momento)) as segundos
        from m c
        cross join lateral (select x.momento from agente_mensajes x
                             where x.lead_id = c.lead_id and x.rol = 'agente' and x.tipo = 'normal' and x.momento > c.momento
                             order by x.momento limit 1) r
       where c.rol = 'cliente' and r.momento < c.momento + interval '2 hours'
    ),
    -- Conversaciones en etapas del agente cuyo último mensaje es de la persona, hace más de 10 minutos, sin respuesta.
    ultimo as (
      select distinct on (x.lead_id) x.lead_id, x.rol, x.texto, x.momento
        from agente_mensajes x
       where x.tipo <> 'sin_seguimiento' and x.lead_id in (select lead_id from m where dia >= p_desde)
       order by x.lead_id, x.momento desc
    ),
    pendientes as (
      select u.lead_id, u.texto, u.momento, l.nombre, l.origen, l.utm_source, e.nombre as etapa, e.tipo as etapa_tipo
        from ultimo u
        join kommo_lead l on l.lead_id = u.lead_id
        left join kommo_etapa e on e.etapa_id = l.etapa_id
       where u.rol = 'cliente' and u.momento < now() - interval '10 minutes' and l.etapa_id = any(etapas_agente)
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
          'correos', (select count(*) from atendidas where dia >= p_desde and correo),
          'correos_ant', (select count(*) from atendidas where dia <= a_hasta and correo),
          'seguimientos', (select count(*) from seg where dia >= p_desde),
          'seguimientos_ant', (select count(*) from seg where dia <= a_hasta),
          'reactivadas', (select count(*) from seg where dia >= p_desde and respondio),
          'reactivadas_ant', (select count(*) from seg where dia <= a_hasta and respondio),
          'espera_mediana', (select round(percentile_cont(0.5) within group (order by segundos)) from espera where dia >= p_desde),
          'espera_mediana_ant', (select round(percentile_cont(0.5) within group (order by segundos)) from espera where dia <= a_hasta),
          'sin_respuesta', (select count(*) from pendientes)) from k),
      'serie', coalesce((
        select jsonb_agg(jsonb_build_object('fecha', d.dia::date, 'conversaciones', coalesce(x.conversaciones, 0), 'respuestas', coalesce(x.respuestas, 0),
                                            'seguimientos', coalesce(x.seguimientos, 0)) order by d.dia)
          from generate_series(p_desde, p_hasta, interval '1 day') as d(dia)
          left join (select dia, count(distinct lead_id) filter (where rol = 'cliente') conversaciones,
                            count(*) filter (where rol = 'agente' and tipo = 'normal') respuestas,
                            count(*) filter (where rol = 'agente' and tipo = 'seguimiento') seguimientos
                       from m group by dia) x on x.dia = d.dia::date), '[]'::jsonb),
      -- Hasta dónde llegan las conversaciones atendidas del periodo. Cada fila cuenta las que llegaron a ese punto o más
      -- allá (quien se adelanta y pide la demo de una vez cuenta en los pasos que se saltó).
      'guion', (
        select jsonb_agg(jsonb_build_object('orden', p.orden, 'paso', p.paso, 'conversaciones', p.n,
                                            'tasa', case when t.total > 0 then p.n::numeric / t.total end) order by p.orden)
          from (select count(*) total from atendidas where dia >= p_desde) t,
          lateral (values
            (1, 'El agente respondió', (select count(*) from atendidas where dia >= p_desde)),
            (2, 'La persona siguió la conversación', (select count(*) from atendidas where dia >= p_desde and siguio)),
            (3, 'Preguntó el tipo de servicio', (select count(*) from atendidas where dia >= p_desde and paso >= 1)),
            (4, 'Preguntó por la herramienta actual', (select count(*) from atendidas where dia >= p_desde and paso >= 2)),
            (5, 'Preguntó el reto', (select count(*) from atendidas where dia >= p_desde and paso >= 3)),
            (6, 'Explicó WIP', (select count(*) from atendidas where dia >= p_desde and paso >= 4)),
            (7, 'Ofreció la demo', (select count(*) from atendidas where dia >= p_desde and paso >= 5)),
            (8, 'Envió el enlace de agenda', (select count(*) from atendidas where dia >= p_desde and paso >= 6)),
            (9, 'Dio su correo', (select count(*) from atendidas where dia >= p_desde and correo)),
            (10, 'Llegó a reunión', (select count(*) from atendidas where dia >= p_desde and reunion))
          ) as p(orden, paso, n)),
      'sin_respuesta', coalesce((
        select jsonb_agg(jsonb_build_object(
            'ultimo', p.momento,
            'nombre', coalesce(nullif(p.nombre, ''), 'Oportunidad ' || p.lead_id),
            'origen', origen_kommo(p.origen, p.utm_source),
            'etapa', coalesce(etapa_tablero(p.etapa, p.etapa_tipo), '—'),
            'ultimo_mensaje', left(p.texto, 160),
            'kommo', 'https://wiptool.kommo.com/leads/detail/' || p.lead_id) order by p.momento desc)
          from pendientes p), '[]'::jsonb),
      'conversaciones', coalesce((
        select jsonb_agg(c order by c->>'ultimo' desc) from (
          select jsonb_build_object(
            'lead_id', m.lead_id,
            'nombre', coalesce(nullif(l.nombre, ''), 'Oportunidad ' || m.lead_id),
            'origen', origen_kommo(l.origen, l.utm_source),
            'etapa', coalesce(etapa_tablero(e.nombre, e.tipo), '—'),
            'recibidos', count(*) filter (where m.rol = 'cliente'),
            'respuestas', count(*) filter (where m.rol = 'agente' and m.tipo = 'normal'),
            'paso', case when not bool_or(m.rol = 'agente' and m.tipo = 'normal') then '—'
                         else (array['Saludo', 'Tipo de servicio', 'Herramienta', 'Reto', 'Explicó WIP', 'Ofreció demo', 'Envió agenda'])
                              [coalesce(max(agente_paso(m.texto)) filter (where m.rol = 'agente' and m.tipo = 'normal'), 0) + 1] end,
            'correo', case when bool_or(m.rol = 'cliente' and agente_tiene_correo(m.texto)) then 'Sí' else 'No' end,
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
        select jsonb_agg(jsonb_build_object('origen', origen, 'atendidas', atendidas, 'correos', correos, 'reuniones', reuniones, 'traspasos', traspasos) order by atendidas desc)
          from (select origen_kommo(l.origen, l.utm_source) origen, count(*) atendidas, count(*) filter (where a.correo) correos,
                       count(*) filter (where a.reunion) reuniones, count(*) filter (where a.traspaso) traspasos
                  from atendidas a left join kommo_lead l on l.lead_id = a.lead_id
                 where a.dia >= p_desde group by 1) o), '[]'::jsonb)
    )
  );
end $$;
revoke all on function tablero_agente(date, date, date) from anon;
revoke all on function agente_paso(text) from anon;
revoke all on function agente_tiene_correo(text) from anon;
