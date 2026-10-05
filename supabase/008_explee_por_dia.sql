-- Explee por día, en hora de Colombia (2026-10-05).
-- La API de Explee no da cifras por día: solo "hoy" (en su zona horaria), 7d, 30d o todo. Antes se guardaba cada hora
-- lo de "hoy"; ahora se guarda cada hora el total acumulado de cada campaña (period=all) y lo de cada día es la resta
-- entre el último total de ese día y el último del día anterior. Si una carga falla no se pierde nada: entra en la siguiente.
-- Los días hasta el primer registro acumulado (2026-10-05) quedan como estaban.

create table if not exists explee_acumulado (
  fecha      date not null,         -- día en Colombia del registro
  momento    timestamptz not null,
  campana_id text not null,
  campana    text not null default '',
  enviados   integer not null default 0,
  respuestas integer not null default 0,
  leads      integer not null default 0,
  gasto_usd  numeric not null default 0,
  primary key (momento, campana_id)
);

-- Rehace explee_campana_diario de p_dia y del día anterior a partir de los totales acumulados.
create or replace function explee_recalcular_diario(p_dia date) returns void
language plpgsql security definer set search_path = public as $$
declare d date; inicio date;
begin
  select min(fecha) into inicio from explee_acumulado;
  if inicio is null then return; end if;
  for d in select generate_series(greatest(p_dia - 1, inicio + 1), p_dia, interval '1 day')::date loop
    delete from explee_campana_diario where fecha = d;
    insert into explee_campana_diario (fecha, campana_id, campana, enviados, respuestas, leads, gasto_usd)
    select d, f.campana_id, f.campana,
           greatest(f.enviados - coalesce(b.enviados, 0), 0), greatest(f.respuestas - coalesce(b.respuestas, 0), 0),
           greatest(f.leads - coalesce(b.leads, 0), 0), greatest(f.gasto_usd - coalesce(b.gasto_usd, 0), 0)
      from (select distinct on (campana_id) * from explee_acumulado where fecha <= d order by campana_id, momento desc) f
      left join (select distinct on (campana_id) * from explee_acumulado where fecha < d order by campana_id, momento desc) b
        using (campana_id);
  end loop;
end $$;
revoke all on function explee_recalcular_diario(date) from public, anon, authenticated;

-- Los leads calientes se acumulan (la API se consulta con since=); ya no se reemplaza la lista completa.
alter table explee_lead drop constraint if exists explee_lead_pkey;
alter table explee_lead add primary key (lead_id);

-- Leads calientes que aún no pasaron a Kommo (los lee F4 en n8n con la clave de servicio).
create or replace view explee_pendientes_kommo as
  select l.* from explee_lead l where not exists (select 1 from explee_kommo k where k.lead_id = l.lead_id);
revoke all on explee_pendientes_kommo from anon, authenticated;

do $$
begin
  execute 'alter table explee_acumulado enable row level security';
  execute 'drop policy if exists solo_equipo on explee_acumulado';
  execute 'create policy solo_equipo on explee_acumulado for select to authenticated using (es_equipo_wip())';
  execute 'revoke all on explee_acumulado from anon';
end $$;

create or replace function cargar(p_tabla text, p_desde date, p_hasta date, p_filas jsonb,
                                  p_fuente text default null, p_sitio text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_tabla not in ('ga4_canal_diario','ga4_evento_diario','ga4_pagina_diario','ga4_audiencia_diario',
                     'gsc_pagina_diario','gsc_consulta_diario',
                     'meta_campana_diario','gads_campana_diario','trm_diaria',
                     'brevo_campana','brevo_evento_diario','explee_campana_diario','explee_lead','explee_acumulado',
                     'kommo_etapa','kommo_lead','kommo_cambio_etapa') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  if p_tabla in ('kommo_etapa', 'kommo_lead') then
    -- la lista completa se reemplaza en cada carga (Supabase exige un WHERE)
    execute format('delete from %I where true', p_tabla);
  elsif p_tabla in ('explee_lead', 'explee_acumulado') then
    null; -- se acumulan: no se borra nada
  elsif p_sitio is null then
    execute format('delete from %I where fecha between $1 and $2', p_tabla) using p_desde, p_hasta;
  else
    execute format('delete from %I where fecha between $1 and $2 and sitio = $3', p_tabla) using p_desde, p_hasta, p_sitio;
  end if;
  execute format('insert into %I select * from jsonb_populate_recordset(null::%I, $1) on conflict do nothing', p_tabla, p_tabla) using p_filas;
  get diagnostics n = row_count;
  if p_tabla = 'explee_acumulado' then
    perform explee_recalcular_diario(p_hasta);
  end if;
  if p_fuente is not null then
    insert into cargas (fuente, actualizado, filas, estado, mensaje) values (p_fuente, now(), n, 'ok', '')
    on conflict (fuente) do update set actualizado = excluded.actualizado, filas = excluded.filas, estado = 'ok', mensaje = '';
  end if;
  return n;
end $$;
revoke all on function cargar(text, date, date, jsonb, text, text) from public, anon, authenticated;
