-- Tablero WIP · T2: pauta (Meta Ads y Google Ads), costos fijos, TRM e inversión total en pesos.
-- Se corre una vez en el editor SQL de Supabase, después de 001 y 002. Es idempotente.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- TRM oficial (Superfinanciera, datos.gov.co): pesos por dólar, un valor por día.
create table if not exists trm_diaria (
  fecha date primary key,
  valor numeric not null
);

-- Meta Ads por día y campaña. La inversión va en la moneda de la cuenta (se pasa a pesos al consultar).
create table if not exists meta_campana_diario (
  fecha          date not null,
  campana_id     text not null,
  campana        text not null default '',
  moneda         text not null default 'COP',
  inversion      numeric not null default 0,
  impresiones    integer not null default 0,
  clics          integer not null default 0,
  conversaciones integer not null default 0, -- onsite_conversion.messaging_conversation_started_7d
  primary key (fecha, campana_id)
);

-- Google Ads por día y campaña (lo envía el script de la cuenta de Google Ads).
create table if not exists gads_campana_diario (
  fecha        date not null,
  campana_id   text not null,
  campana      text not null default '',
  moneda       text not null default 'COP',
  inversion    numeric not null default 0,
  impresiones  integer not null default 0,
  clics        integer not null default 0,
  conversiones numeric not null default 0,
  primary key (fecha, campana_id)
);

-- Suscripciones y costos fijos (Brevo, etc.). Las edita el equipo desde el tablero.
-- El costo mensual se reparte por día (monto ÷ días del mes) entre "desde" y "hasta".
create table if not exists costos_fijos (
  id              bigint generated always as identity primary key,
  plataforma      text not null,
  monto           numeric not null check (monto >= 0),
  moneda          text not null default 'COP' check (moneda in ('COP', 'USD')),
  desde           date not null,
  hasta           date,
  nota            text not null default '',
  actualizado_por text not null default '',
  actualizado     timestamptz not null default now(),
  check (hasta is null or hasta >= desde)
);

-- Brevo (plan Starter, USD 17 al mes desde el 2 de julio de 2026), el mismo valor que tenía la hoja "Costos fijos".
insert into costos_fijos (plataforma, monto, moneda, desde, nota, actualizado_por)
select 'Brevo', 17, 'USD', '2026-07-02', 'Plan Starter', 'carga inicial'
where not exists (select 1 from costos_fijos where plataforma = 'Brevo');

-- ---------------------------------------------------------------------------
-- Seguridad: el equipo lee todo; los costos fijos además los puede editar.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['trm_diaria','meta_campana_diario','gads_campana_diario','costos_fijos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists solo_equipo on %I', t);
    execute format('create policy solo_equipo on %I for select to authenticated using (es_equipo_wip())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

drop policy if exists equipo_edita on costos_fijos;
create policy equipo_edita on costos_fijos for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip());

-- ---------------------------------------------------------------------------
-- Carga: se agregan las tablas nuevas a las que puede escribir n8n.
-- ---------------------------------------------------------------------------
create or replace function cargar(p_tabla text, p_desde date, p_hasta date, p_filas jsonb,
                                  p_fuente text default null, p_sitio text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_tabla not in ('ga4_canal_diario','ga4_evento_diario','ga4_pagina_diario','ga4_audiencia_diario',
                     'gsc_pagina_diario','gsc_consulta_diario',
                     'meta_campana_diario','gads_campana_diario','trm_diaria') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  if p_sitio is null then
    execute format('delete from %I where fecha between $1 and $2', p_tabla) using p_desde, p_hasta;
  else
    execute format('delete from %I where fecha between $1 and $2 and sitio = $3', p_tabla) using p_desde, p_hasta, p_sitio;
  end if;
  execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1)', p_tabla, p_tabla) using p_filas;
  get diagnostics n = row_count;
  if p_fuente is not null then
    insert into cargas (fuente, actualizado, filas, estado, mensaje) values (p_fuente, now(), n, 'ok', '')
    on conflict (fuente) do update set actualizado = excluded.actualizado, filas = excluded.filas, estado = 'ok', mensaje = '';
  end if;
  return n;
end $$;
revoke all on function cargar(text, date, date, jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Inversión diaria en pesos, por plataforma (Meta, Google Ads y cada costo fijo).
-- ---------------------------------------------------------------------------
create or replace function trm_en(p_fecha date) returns numeric
language sql stable as $$
  select valor from trm_diaria where fecha <= p_fecha order by fecha desc limit 1
$$;

create or replace function a_pesos(p_monto numeric, p_moneda text, p_fecha date) returns numeric
language sql stable as $$
  select case when upper(p_moneda) = 'COP' then p_monto else p_monto * coalesce(trm_en(p_fecha), 0) end
$$;

create or replace function inversion_diaria(p_desde date, p_hasta date)
returns table (fecha date, plataforma text, cop numeric)
language sql stable as $$
  select m.fecha, 'Meta', sum(a_pesos(m.inversion, m.moneda, m.fecha))
    from meta_campana_diario m where m.fecha between p_desde and p_hasta group by m.fecha
  union all
  select g.fecha, 'Google Ads', sum(a_pesos(g.inversion, g.moneda, g.fecha))
    from gads_campana_diario g where g.fecha between p_desde and p_hasta group by g.fecha
  union all
  select d.dia, c.plataforma,
         a_pesos(c.monto / extract(day from (date_trunc('month', d.dia) + interval '1 month - 1 day'))::numeric, c.moneda, d.dia)
    from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
    join costos_fijos c on d.dia >= c.desde and (c.hasta is null or d.dia <= c.hasta)
$$;

-- ---------------------------------------------------------------------------
-- Página Pauta
-- ---------------------------------------------------------------------------
create or replace function tablero_pauta(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  a_hasta date := p_desde - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'total',              (select coalesce(sum(cop), 0) from inversion_diaria(p_desde, p_hasta)),
      'total_ant',          (select coalesce(sum(cop), 0) from inversion_diaria(a_desde, a_hasta)),
      'meta',               (select coalesce(sum(a_pesos(inversion, moneda, fecha)), 0) from meta_campana_diario where fecha between p_desde and p_hasta),
      'meta_ant',           (select coalesce(sum(a_pesos(inversion, moneda, fecha)), 0) from meta_campana_diario where fecha between a_desde and a_hasta),
      'conversaciones',     (select coalesce(sum(conversaciones), 0) from meta_campana_diario where fecha between p_desde and p_hasta),
      'conversaciones_ant', (select coalesce(sum(conversaciones), 0) from meta_campana_diario where fecha between a_desde and a_hasta),
      'meta_clics',         (select coalesce(sum(clics), 0) from meta_campana_diario where fecha between p_desde and p_hasta),
      'meta_clics_ant',     (select coalesce(sum(clics), 0) from meta_campana_diario where fecha between a_desde and a_hasta),
      'meta_impresiones',   (select coalesce(sum(impresiones), 0) from meta_campana_diario where fecha between p_desde and p_hasta),
      'gads',               (select coalesce(sum(a_pesos(inversion, moneda, fecha)), 0) from gads_campana_diario where fecha between p_desde and p_hasta),
      'gads_ant',           (select coalesce(sum(a_pesos(inversion, moneda, fecha)), 0) from gads_campana_diario where fecha between a_desde and a_hasta),
      'gads_clics',         (select coalesce(sum(clics), 0) from gads_campana_diario where fecha between p_desde and p_hasta),
      'gads_conversiones',  (select coalesce(sum(conversiones), 0) from gads_campana_diario where fecha between p_desde and p_hasta)
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'inversion', round(coalesce(i.cop, 0)),
                                                   'conversaciones', coalesce(m.conv, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
      left join (select fecha, sum(cop) cop from inversion_diaria(p_desde, p_hasta) group by fecha) i on i.fecha = d.dia
      left join (select fecha, sum(conversaciones) conv from meta_campana_diario where fecha between p_desde and p_hasta group by fecha) m on m.fecha = d.dia
    ),
    'por_plataforma', (
      select coalesce(jsonb_agg(jsonb_build_object('plataforma', plataforma, 'inversion', round(cop)) order by cop desc), '[]'::jsonb)
      from (select plataforma, sum(cop) cop from inversion_diaria(p_desde, p_hasta) group by 1) x
    ),
    'por_mes', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'plataforma', plataforma, 'inversion', round(cop)) order by mes desc, plataforma), '[]'::jsonb)
      from (select to_char(fecha, 'YYYY-MM') mes, plataforma, sum(cop) cop from inversion_diaria(p_desde, p_hasta) group by 1, 2) x
    ),
    'campanas_meta', (
      select coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'inversion', round(inv), 'clics', clics,
                                                    'conversaciones', conv, 'costo', case when conv > 0 then round(inv / conv) end) order by inv desc), '[]'::jsonb)
      from (select max(campana) campana, sum(a_pesos(inversion, moneda, fecha)) inv, sum(clics) clics, sum(conversaciones) conv
            from meta_campana_diario where fecha between p_desde and p_hasta group by campana_id) x
    ),
    'campanas_gads', (
      select coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'inversion', round(inv), 'clics', clics,
                                                    'conversiones', round(conv, 1), 'costo', case when conv > 0 then round(inv / conv) end) order by inv desc), '[]'::jsonb)
      from (select max(campana) campana, sum(a_pesos(inversion, moneda, fecha)) inv, sum(clics) clics, sum(conversiones) conv
            from gads_campana_diario where fecha between p_desde and p_hasta group by campana_id) x
    )
  );
end $$;

-- Inversión total para la cifra del Resumen.
create or replace function tablero_inversion(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare n int := p_hasta - p_desde + 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'total',     (select coalesce(round(sum(cop)), 0) from inversion_diaria(p_desde, p_hasta)),
    'total_ant', (select coalesce(round(sum(cop)), 0) from inversion_diaria(p_desde - n, p_desde - 1))
  );
end $$;

revoke all on function tablero_pauta(date, date) from anon;
revoke all on function tablero_inversion(date, date) from anon;
