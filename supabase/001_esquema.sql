-- Tablero WIP: esquema de la base de datos (Supabase / Postgres).
-- Solo guarda cifras agregadas por día: nada de nombres, correos ni teléfonos.
-- Las carga n8n (flujo F12) con la función cargar(); el tablero solo lee con las funciones tablero_*.
-- Se corre una vez en el editor SQL de Supabase. Es idempotente: se puede volver a correr.

-- ---------------------------------------------------------------------------
-- Tablas de Google Analytics 4
-- ---------------------------------------------------------------------------

-- Visitas y conversiones por día y por origen de la sesión.
create table if not exists ga4_canal_diario (
  fecha        date not null,
  canal        text not null default '',  -- sessionDefaultChannelGroup
  fuente       text not null default '',  -- sessionSource
  medio        text not null default '',  -- sessionMedium
  campana      text not null default '',  -- sessionCampaignName
  contenido    text not null default '',  -- sessionManualAdContent (campaña corta de Explee, correo de Brevo)
  termino      text not null default '',  -- sessionManualTerm (cliente de App sin app)
  visitas      integer not null default 0, -- sessions
  conversiones integer not null default 0, -- keyEvents
  primary key (fecha, canal, fuente, medio, campana, contenido, termino)
);

-- Eventos por día, con el origen de los clics medidos (parámetros origen y correo).
create table if not exists ga4_evento_diario (
  fecha        date not null,
  evento       text not null,             -- eventName
  origen       text not null default '',  -- customEvent:origen
  correo       text not null default '',  -- customEvent:correo
  eventos      integer not null default 0, -- eventCount
  conversiones integer not null default 0, -- keyEvents (0 si el evento no es clave)
  personas     integer not null default 0, -- totalUsers del día (se suman entre días)
  primary key (fecha, evento, origen, correo)
);

-- Páginas de entrada.
create table if not exists ga4_pagina_diario (
  fecha        date not null,
  pagina       text not null,             -- landingPage
  visitas      integer not null default 0,
  conversiones integer not null default 0,
  primary key (fecha, pagina)
);

-- País y dispositivo.
create table if not exists ga4_audiencia_diario (
  fecha        date not null,
  pais         text not null default '',  -- country
  dispositivo  text not null default '',  -- deviceCategory
  visitas      integer not null default 0,
  conversiones integer not null default 0,
  primary key (fecha, pais, dispositivo)
);

-- ---------------------------------------------------------------------------
-- Tablas de Search Console (propiedad sc-domain:wiptool.com)
-- sitio = 'wiptool.com' o 'platform.wiptool.com', según el host de la página.
-- pos_x_imp = posición × impresiones, para promediar la posición bien ponderada.
-- ---------------------------------------------------------------------------

create table if not exists gsc_pagina_diario (
  fecha       date not null,
  sitio       text not null,
  pagina      text not null,
  clics       integer not null default 0,
  impresiones integer not null default 0,
  pos_x_imp   double precision not null default 0,
  primary key (fecha, sitio, pagina)
);

create table if not exists gsc_consulta_diario (
  fecha       date not null,
  sitio       text not null,
  consulta    text not null,
  clics       integer not null default 0,
  impresiones integer not null default 0,
  pos_x_imp   double precision not null default 0,
  primary key (fecha, sitio, consulta)
);

-- ---------------------------------------------------------------------------
-- Registro de cargas: el tablero muestra desde cuándo no se actualiza cada fuente.
-- ---------------------------------------------------------------------------
create table if not exists cargas (
  fuente      text primary key,           -- ga4, gsc, meta, ...
  actualizado timestamptz not null default now(),
  filas       integer not null default 0,
  estado      text not null default 'ok', -- ok | error
  mensaje     text not null default ''
);

-- ---------------------------------------------------------------------------
-- Seguridad: solo personas con cuenta @wiptool.com pueden leer. Nadie escribe
-- desde el navegador; n8n escribe con la clave de servicio (que salta RLS).
-- ---------------------------------------------------------------------------
create or replace function es_equipo_wip() returns boolean
language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@wiptool.com', false)
$$;

do $$
declare t text;
begin
  foreach t in array array['ga4_canal_diario','ga4_evento_diario','ga4_pagina_diario','ga4_audiencia_diario',
                           'gsc_pagina_diario','gsc_consulta_diario','cargas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists solo_equipo on %I', t);
    execute format('create policy solo_equipo on %I for select to authenticated using (es_equipo_wip())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Carga (solo n8n, con la clave de servicio). Reemplaza las filas de un rango de
-- fechas de una tabla y registra la carga. Así recargar los últimos días es seguro.
--   select cargar('ga4_canal_diario', '2026-09-01', '2026-09-03', '[{...}, ...]'::jsonb, 'ga4');
-- Para gsc_*, p_sitio limita el borrado a un sitio (null = todos).
-- ---------------------------------------------------------------------------
create or replace function cargar(p_tabla text, p_desde date, p_hasta date, p_filas jsonb,
                                  p_fuente text default null, p_sitio text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_tabla not in ('ga4_canal_diario','ga4_evento_diario','ga4_pagina_diario','ga4_audiencia_diario',
                     'gsc_pagina_diario','gsc_consulta_diario') then
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

-- Registra un error de carga (lo llama el aviso de errores de n8n).
create or replace function registrar_error(p_fuente text, p_mensaje text) returns void
language sql security definer set search_path = public as $$
  insert into cargas (fuente, actualizado, estado, mensaje) values (p_fuente, now(), 'error', left(p_mensaje, 500))
  on conflict (fuente) do update set estado = 'error', mensaje = left(excluded.mensaje, 500);
$$;

revoke all on function cargar(text, date, date, jsonb, text, text) from public, anon, authenticated;
revoke all on function registrar_error(text, text) from public, anon, authenticated;
