-- Tablero WIP · T4: Embudo con los datos de Kommo.
-- Se corre una vez en el editor SQL de Supabase, después de 001 a 004. Es idempotente.

-- ---------------------------------------------------------------------------
-- Tablas (las llena n8n desde la API de Kommo)
-- ---------------------------------------------------------------------------

-- Etapas del embudo, en su orden. tipo: abierta | ganada (142) | perdida (143) | entrantes.
create table if not exists kommo_etapa (
  fecha     date,                 -- sin uso; cargar() la exige en todas las tablas
  etapa_id  bigint primary key,
  embudo_id bigint not null,
  nombre    text not null,
  orden     integer not null,
  tipo      text not null
);

-- Oportunidades (leads), con su estado actual. Se reemplaza la lista completa en cada carga.
create table if not exists kommo_lead (
  fecha          date,            -- día de creación (hora de Bogotá)
  lead_id        bigint primary key,
  nombre         text not null default '',
  embudo_id      bigint,
  etapa_id       bigint,
  valor          numeric not null default 0,
  origen         text not null default '', -- campo "Origen" de Kommo
  campana        text not null default '', -- campo "Campaña"
  utm_source     text not null default '',
  utm_campaign   text not null default '',
  responsable    text not null default '',
  motivo_perdida text not null default '',
  creado         timestamptz,
  actualizado    timestamptz,
  cerrado        timestamptz
);

-- Cada cambio de etapa (evento lead_status_changed de Kommo).
create table if not exists kommo_cambio_etapa (
  fecha     date not null,        -- día del cambio (hora de Bogotá)
  evento_id text primary key,
  lead_id   bigint not null,
  de_etapa  bigint,
  a_etapa   bigint not null,
  momento   timestamptz not null
);
create index if not exists kommo_cambio_etapa_lead on kommo_cambio_etapa (lead_id, momento);

do $$
declare t text;
begin
  foreach t in array array['kommo_etapa','kommo_lead','kommo_cambio_etapa'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists solo_equipo on %I', t);
    execute format('create policy solo_equipo on %I for select to authenticated using (es_equipo_wip())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Carga: tablas de Kommo. Las etapas y las oportunidades se reemplazan completas.
-- ---------------------------------------------------------------------------
create or replace function cargar(p_tabla text, p_desde date, p_hasta date, p_filas jsonb,
                                  p_fuente text default null, p_sitio text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_tabla not in ('ga4_canal_diario','ga4_evento_diario','ga4_pagina_diario','ga4_audiencia_diario',
                     'gsc_pagina_diario','gsc_consulta_diario',
                     'meta_campana_diario','gads_campana_diario','trm_diaria',
                     'brevo_campana','brevo_evento_diario','explee_campana_diario','explee_lead',
                     'kommo_etapa','kommo_lead','kommo_cambio_etapa') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  if p_tabla in ('explee_lead', 'kommo_etapa', 'kommo_lead') then
    -- la lista completa se reemplaza en cada carga (Supabase exige un WHERE)
    execute format('delete from %I where true', p_tabla);
  elsif p_sitio is null then
    execute format('delete from %I where fecha between $1 and $2', p_tabla) using p_desde, p_hasta;
  else
    execute format('delete from %I where fecha between $1 and $2 and sitio = $3', p_tabla) using p_desde, p_hasta, p_sitio;
  end if;
  execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1) on conflict do nothing', p_tabla, p_tabla) using p_filas;
  get diagnostics n = row_count;
  if p_fuente is not null then
    insert into cargas (fuente, actualizado, filas, estado, mensaje) values (p_fuente, now(), n, 'ok', '')
    on conflict (fuente) do update set actualizado = excluded.actualizado, filas = excluded.filas, estado = 'ok', mensaje = '';
  end if;
  return n;
end $$;
revoke all on function cargar(text, date, date, jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Embudo
-- ---------------------------------------------------------------------------
-- Origen de una oportunidad: el campo "Origen" de Kommo; si está vacío, se deduce del utm_source.
create or replace function origen_kommo(p_origen text, p_utm text) returns text
language sql immutable as $$
  select case
    when coalesce(p_origen, '') <> '' then p_origen
    when lower(p_utm) like '%explee%' then 'Explee'
    when lower(p_utm) in ('instagram', 'ig') then 'Instagram'
    when lower(p_utm) in ('facebook', 'fb') then 'Facebook'
    when lower(p_utm) in ('brevo', 'sendinblue', 'email') then 'Correo (Brevo)'
    when lower(p_utm) = 'google' then 'Google Ads'
    when lower(p_utm) = 'linkedin' then 'LinkedIn'
    else 'Sin origen'
  end
$$;

-- A qué origen del embudo corresponde la inversión de cada plataforma (para el costo por reunión y por cliente).
create or replace function origen_inversion(p_plataforma text) returns text
language sql immutable as $$
  select case lower(p_plataforma)
    when 'meta' then 'Meta Ads'
    when 'google ads' then 'Google Ads'
    when 'explee' then 'Explee'
    when 'brevo' then 'Correo (Brevo)'
    else 'Herramientas'
  end
$$;

-- Nombre de etapa para el tablero (las de cierre y la de entrada de Kommo no se pueden renombrar por la API y llegan en inglés).
create or replace function etapa_tablero(p_nombre text, p_tipo text) returns text
language sql immutable as $$
  select case p_tipo when 'ganada' then 'Cliente activo' when 'perdida' then 'Perdido' when 'entrantes' then 'Leads entrantes' else p_nombre end
$$;

create or replace function tablero_embudo(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  a_hasta date := p_desde - 1;
  o_agendada int := (select orden from kommo_etapa where nombre ilike 'reuni%n agendada' limit 1);
  o_hecha    int := (select orden from kommo_etapa where nombre ilike 'reuni%n hecha' limit 1);
  o_cliente  int := (select orden from kommo_etapa where tipo = 'ganada' limit 1);
begin
  perform exigir_equipo();
  return (
    with
    -- Primer momento en que cada oportunidad llegó a cada etapa abierta o ganada (llegar a una etapa posterior cuenta como haber pasado por las anteriores).
    llegadas as (
      select c.lead_id, e.orden, min(c.momento) momento
      from kommo_cambio_etapa c join kommo_etapa e on e.etapa_id = c.a_etapa
      where e.tipo in ('abierta', 'ganada')
      group by 1, 2
    ),
    hitos as (
      select l.lead_id, origen_kommo(l.origen, l.utm_source) origen, l.creado,
             (select min(x.momento) from llegadas x where x.lead_id = l.lead_id and x.orden >= o_agendada) agendada,
             (select min(x.momento) from llegadas x where x.lead_id = l.lead_id and x.orden >= o_hecha) hecha,
             (select min(x.momento) from llegadas x where x.lead_id = l.lead_id and x.orden >= o_cliente) cliente
      from kommo_lead l
    ),
    dia as (
      select h.*, (h.creado at time zone 'America/Bogota')::date d_creado, (h.agendada at time zone 'America/Bogota')::date d_agendada,
             (h.hecha at time zone 'America/Bogota')::date d_hecha, (h.cliente at time zone 'America/Bogota')::date d_cliente
      from hitos h
    ),
    inversion as (select coalesce(sum(cop), 0) total from inversion_diaria(p_desde, p_hasta)),
    inversion_ant as (select coalesce(sum(cop), 0) total from inversion_diaria(a_desde, a_hasta))
    select jsonb_build_object(
      'kpis', jsonb_build_object(
        'nuevas',         (select count(*) from dia where d_creado between p_desde and p_hasta),
        'nuevas_ant',     (select count(*) from dia where d_creado between a_desde and a_hasta),
        'agendadas',      (select count(*) from dia where d_agendada between p_desde and p_hasta),
        'agendadas_ant',  (select count(*) from dia where d_agendada between a_desde and a_hasta),
        'hechas',         (select count(*) from dia where d_hecha between p_desde and p_hasta),
        'hechas_ant',     (select count(*) from dia where d_hecha between a_desde and a_hasta),
        'clientes',       (select count(*) from dia where d_cliente between p_desde and p_hasta),
        'clientes_ant',   (select count(*) from dia where d_cliente between a_desde and a_hasta),
        'inversion',      (select round(total) from inversion),
        'inversion_ant',  (select round(total) from inversion_ant),
        'abiertas',       (select count(*) from kommo_lead l join kommo_etapa e on e.etapa_id = l.etapa_id where e.tipo in ('abierta', 'entrantes'))
      ),
      'etapas', (
        select coalesce(jsonb_agg(jsonb_build_object('etapa', etapa_tablero(e.nombre, e.tipo), 'tipo', e.tipo, 'oportunidades', coalesce(x.n, 0),
                                                      'valor', coalesce(x.v, 0)) order by e.orden), '[]'::jsonb)
        from kommo_etapa e
        left join (select etapa_id, count(*) n, sum(valor) v from kommo_lead group by 1) x on x.etapa_id = e.etapa_id
      ),
      'por_origen', (
        select coalesce(jsonb_agg(jsonb_build_object('origen', o.origen, 'nuevas', o.nuevas, 'agendadas', o.agendadas, 'hechas', o.hechas,
                                                      'clientes', o.clientes, 'inversion', round(coalesce(i.cop, 0)),
                                                      'costo_reunion', case when o.agendadas > 0 and i.cop > 0 then round(i.cop / o.agendadas) end,
                                                      'costo_cliente', case when o.clientes > 0 and i.cop > 0 then round(i.cop / o.clientes) end)
                                  order by o.nuevas desc, o.origen), '[]'::jsonb)
        from (select origen,
                     count(*) filter (where d_creado between p_desde and p_hasta) nuevas,
                     count(*) filter (where d_agendada between p_desde and p_hasta) agendadas,
                     count(*) filter (where d_hecha between p_desde and p_hasta) hechas,
                     count(*) filter (where d_cliente between p_desde and p_hasta) clientes
              from dia group by 1) o
        left join (select origen_inversion(plataforma) origen, sum(cop) cop from inversion_diaria(p_desde, p_hasta) group by 1) i on i.origen = o.origen
        where o.nuevas + o.agendadas + o.hechas + o.clientes > 0
      ),
      'tiempos', jsonb_build_object(
        'a_agendada', (select round(avg(extract(epoch from agendada - creado) / 86400)::numeric, 1) from dia where d_agendada between p_desde and p_hasta),
        'a_hecha',    (select round(avg(extract(epoch from hecha - creado) / 86400)::numeric, 1) from dia where d_hecha between p_desde and p_hasta),
        'a_cliente',  (select round(avg(extract(epoch from cliente - creado) / 86400)::numeric, 1) from dia where d_cliente between p_desde and p_hasta)
      ),
      'serie', (
        select coalesce(jsonb_agg(jsonb_build_object('fecha', g.d, 'nuevas', (select count(*) from dia where d_creado = g.d),
                                                      'agendadas', (select count(*) from dia where d_agendada = g.d)) order by g.d), '[]'::jsonb)
        from (select generate_series(p_desde, p_hasta, interval '1 day')::date d) g
      ),
      'perdidas', (
        select coalesce(jsonb_agg(jsonb_build_object('motivo', motivo, 'oportunidades', c) order by c desc), '[]'::jsonb)
        from (select coalesce(nullif(l.motivo_perdida, ''), 'Sin motivo') motivo, count(*) c
              from kommo_lead l join kommo_etapa e on e.etapa_id = l.etapa_id
              where e.tipo = 'perdida' and (l.cerrado at time zone 'America/Bogota')::date between p_desde and p_hasta group by 1) x
      ),
      'recientes', (
        select coalesce(jsonb_agg(jsonb_build_object('fecha', l.fecha, 'nombre', l.nombre, 'etapa', etapa_tablero(e.nombre, e.tipo),
                                                      'origen', origen_kommo(l.origen, l.utm_source), 'campana', l.campana, 'responsable', l.responsable,
                                                      'valor', l.valor) order by l.creado desc), '[]'::jsonb)
        from kommo_lead l left join kommo_etapa e on e.etapa_id = l.etapa_id
        where l.fecha between p_desde and p_hasta
      )
    )
  );
end $$;

revoke all on function tablero_embudo(date, date) from anon;
