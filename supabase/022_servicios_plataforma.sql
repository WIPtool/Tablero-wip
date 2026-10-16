-- Operaciones › Servicios (2026-10-15): servicios que se crean en la plataforma WIP (base MongoDB de producción).
-- Un trigger programado de Atlas (atlas/conteo-servicios.js, una vez al día a las 12 m.) cuenta los servicios por día de creación (hora de Colombia),
-- cliente (owner.name), tipo de servicio y estado actual, y los carga aquí con cargar_servicios_atlas(). A Supabase solo
-- llegan esos conteos, nunca datos de los servicios.
-- Como el estado cambia después de creado el servicio, cada carga reemplaza los últimos días (no solo el de hoy).
create table if not exists plataforma_servicio_diario (
  fecha     date not null,                 -- día de creación del servicio, hora de Colombia
  cliente   text not null default '',      -- compañía dueña del servicio en la plataforma
  tipo      text not null default '',      -- tipo de servicio (formulario)
  estado    text not null default '',      -- estado actual del servicio
  servicios integer not null default 0,
  primary key (fecha, cliente, tipo, estado)
);
do $$
begin
  execute 'alter table plataforma_servicio_diario enable row level security';
  execute 'drop policy if exists solo_equipo on plataforma_servicio_diario';
  execute 'create policy solo_equipo on plataforma_servicio_diario for select to authenticated using (es_equipo_wip())';
  execute 'revoke all on plataforma_servicio_diario from anon';
end $$;

-- Carga (solo con la clave de servicio, o desde Atlas por cargar_servicios_atlas): reemplaza los días desde p_desde hasta p_hasta y registra la carga
-- con la fuente 'plataforma'. Carga a mano del histórico: p_desde = el primer día de la plataforma.
create or replace function cargar_servicios(p_desde date, p_hasta date, p_filas jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from plataforma_servicio_diario where fecha between p_desde and p_hasta;
  insert into plataforma_servicio_diario (fecha, cliente, tipo, estado, servicios)
  select fecha, coalesce(cliente, ''), coalesce(tipo, ''), coalesce(estado, ''), sum(servicios)
  from jsonb_populate_recordset(null::plataforma_servicio_diario, p_filas)
  where fecha between p_desde and p_hasta
  group by 1, 2, 3, 4;
  get diagnostics n = row_count;
  insert into cargas (fuente, actualizado, filas, estado, mensaje) values ('plataforma', now(), n, 'ok', '')
  on conflict (fuente) do update set actualizado = excluded.actualizado, filas = excluded.filas, estado = 'ok', mensaje = '';
  return n;
end $$;
revoke all on function cargar_servicios(date, date, jsonb) from public, anon, authenticated;

-- La carga la hace un trigger programado de MongoDB Atlas (proyecto wipglobal-platform-PROD), que cuenta los servicios
-- dentro de Atlas y manda solo los conteos. Para no guardar en Atlas la clave de servicio de Supabase, Atlas usa una
-- clave propia que solo sirve para esta carga: se guarda aquí (nadie la puede leer por la API) y en Atlas como Secret.
-- Verla o cambiarla: en el editor SQL de Supabase, select clave from claves_carga where fuente = 'plataforma';
create table if not exists claves_carga (
  fuente text primary key,
  clave  text not null default encode(extensions.gen_random_bytes(24), 'hex')
);
alter table claves_carga enable row level security;   -- sin políticas: solo postgres y service_role
revoke all on claves_carga from anon, authenticated;
insert into claves_carga (fuente) values ('plataforma') on conflict do nothing;

create or replace function cargar_servicios_atlas(p_clave text, p_desde date, p_hasta date, p_filas jsonb) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if p_clave is null or not exists (select 1 from claves_carga where fuente = 'plataforma' and clave = p_clave) then
    raise exception 'Clave de carga inválida' using errcode = '42501';
  end if;
  return cargar_servicios(p_desde, p_hasta, p_filas);
end $$;
revoke all on function cargar_servicios_atlas(text, date, date, jsonb) from public, authenticated;
grant execute on function cargar_servicios_atlas(text, date, date, jsonb) to anon;

-- Página Operaciones › Servicios. p_meses = cuántos meses mostrar (contando el actual).
-- "Este mes" va del día 1 a hoy y se compara con los mismos días del mes anterior.
create or replace function tablero_servicios(p_meses int default 12) returns jsonb
language plpgsql stable as $$
declare
  hoy       date := (now() at time zone 'America/Bogota')::date;
  mes_actual date := date_trunc('month', hoy)::date;
  mes_ant   date := (date_trunc('month', hoy) - interval '1 month')::date;
  mes_ant2  date := (date_trunc('month', hoy) - interval '2 month')::date;
  corte_ant date := least(mes_ant + (hoy - mes_actual), mes_actual - 1);   -- mismo día del mes anterior (o su último día)
  meses     int  := greatest(2, least(coalesce(p_meses, 12), 120));
  desde     date := (date_trunc('month', hoy) - make_interval(months => meses - 1))::date;
  doce      date := (date_trunc('month', hoy) - interval '12 month')::date;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'ultimo_dia', (select max(fecha) from plataforma_servicio_diario),
    'kpis', jsonb_build_object(
      'este_mes',          (select coalesce(sum(servicios), 0) from plataforma_servicio_diario where fecha between mes_actual and hoy),
      'este_mes_ant',      (select coalesce(sum(servicios), 0) from plataforma_servicio_diario where fecha between mes_ant and corte_ant),
      'mes_anterior',      (select coalesce(sum(servicios), 0) from plataforma_servicio_diario where fecha >= mes_ant and fecha < mes_actual),
      'mes_anterior_ant',  (select coalesce(sum(servicios), 0) from plataforma_servicio_diario where fecha >= mes_ant2 and fecha < mes_ant),
      'promedio_12',       (select round(coalesce(sum(servicios), 0) / 12.0) from plataforma_servicio_diario where fecha >= doce and fecha < mes_actual),
      'clientes_mes',      (select count(distinct cliente) from plataforma_servicio_diario where fecha between mes_actual and hoy and servicios > 0),
      'clientes_mes_ant',  (select count(distinct cliente) from plataforma_servicio_diario where fecha >= mes_ant and fecha < mes_actual and servicios > 0),
      'periodo',           (select coalesce(sum(servicios), 0) from plataforma_servicio_diario where fecha >= desde and fecha <= hoy)
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', m.mes, 'servicios', coalesce(x.servicios, 0),
                                                   'clientes', coalesce(x.clientes, 0)) order by m.mes), '[]'::jsonb)
      from (select generate_series(desde, mes_actual, interval '1 month')::date as mes) m
      left join (select date_trunc('month', fecha)::date mes, sum(servicios) servicios,
                        count(distinct cliente) filter (where servicios > 0) clientes
                 from plataforma_servicio_diario where fecha >= desde group by 1) x on x.mes = m.mes
    ),
    'por_cliente', (
      select coalesce(jsonb_agg(jsonb_build_object('cliente', cliente, 'este_mes', este_mes, 'mes_anterior', mes_anterior,
                                                   'periodo', periodo, 'promedio', promedio, 'ultimo', ultimo) order by periodo desc), '[]'::jsonb)
      -- promedio = por mes completo del periodo (sin contar el actual)
      from (select coalesce(nullif(cliente, ''), 'Sin cliente') cliente,
                   coalesce(sum(servicios) filter (where fecha >= mes_actual), 0) este_mes,
                   coalesce(sum(servicios) filter (where fecha >= mes_ant and fecha < mes_actual), 0) mes_anterior,
                   sum(servicios) periodo,
                   round(coalesce(sum(servicios) filter (where fecha < mes_actual), 0)::numeric / (meses - 1)) promedio,
                   max(fecha) ultimo
            from plataforma_servicio_diario where fecha >= desde group by 1) x
    ),
    'por_tipo', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'este_mes', este_mes, 'periodo', periodo) order by periodo desc), '[]'::jsonb)
      from (select coalesce(nullif(tipo, ''), 'Sin tipo') tipo, coalesce(sum(servicios) filter (where fecha >= mes_actual), 0) este_mes, sum(servicios) periodo
            from plataforma_servicio_diario where fecha >= desde group by 1) x
    ),
    'por_estado', (
      select coalesce(jsonb_agg(jsonb_build_object('estado', estado, 'este_mes', este_mes, 'periodo', periodo) order by periodo desc), '[]'::jsonb)
      from (select coalesce(nullif(estado, ''), 'Sin estado') estado, coalesce(sum(servicios) filter (where fecha >= mes_actual), 0) este_mes, sum(servicios) periodo
            from plataforma_servicio_diario where fecha >= desde group by 1) x
    ),
    'por_cliente_mes', (
      select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'cliente', cliente, 'servicios', servicios) order by mes, servicios desc), '[]'::jsonb)
      from (select date_trunc('month', fecha)::date mes, coalesce(nullif(cliente, ''), 'Sin cliente') cliente, sum(servicios) servicios
            from plataforma_servicio_diario where fecha >= desde group by 1, 2) x
    )
  );
end $$;
revoke all on function tablero_servicios(int) from anon;
