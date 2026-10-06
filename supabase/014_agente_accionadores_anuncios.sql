-- Agente de WhatsApp: enlaces medidos propios (accionadores) y texto de los anuncios de Meta (2026-10-05).

-- Anuncios de Meta con su texto, para que el agente sepa qué anuncio vio la persona (los chats llegan a Kommo con
-- utm_campaign = nombre de la campaña y utm_content = nombre del anuncio). F12 agrega cada hora los anuncios activos
-- (la cuenta tiene casi 2.000 anuncios históricos); los que se pausan se conservan para los chats que llegaron por ellos.
create table if not exists meta_anuncio (
  fecha      date,                         -- sin uso; cargar() la exige en todas las tablas
  anuncio_id text primary key,
  nombre     text not null default '',
  campana    text not null default '',
  conjunto   text not null default '',
  estado     text not null default '',
  texto      text not null default ''      -- título y texto del anuncio, juntos
);
create index if not exists meta_anuncio_nombre on meta_anuncio (campana, nombre);
do $$
begin
  execute 'alter table meta_anuncio enable row level security';
  execute 'drop policy if exists solo_equipo on meta_anuncio';
  execute 'create policy solo_equipo on meta_anuncio for select to authenticated using (es_equipo_wip())';
  execute 'revoke all on meta_anuncio from anon';
end $$;

create or replace function cargar(p_tabla text, p_desde date, p_hasta date, p_filas jsonb,
                                  p_fuente text default null, p_sitio text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if p_tabla not in ('ga4_canal_diario','ga4_evento_diario','ga4_pagina_diario','ga4_audiencia_diario',
                     'gsc_pagina_diario','gsc_consulta_diario',
                     'meta_campana_diario','gads_campana_diario','trm_diaria','meta_anuncio',
                     'brevo_campana','brevo_evento_diario','explee_campana_diario','explee_lead','explee_acumulado',
                     'kommo_etapa','kommo_lead','kommo_cambio_etapa') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  if p_tabla in ('kommo_etapa', 'kommo_lead') then
    -- la lista completa se reemplaza en cada carga (Supabase exige un WHERE)
    execute format('delete from %I where true', p_tabla);
  elsif p_tabla in ('explee_lead', 'explee_acumulado', 'meta_anuncio') then
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

-- Enlaces medidos que usa el agente de WhatsApp (redirects en vercel.json de landing-wip).
insert into accionadores (plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa, actualizado_por)
select v.*, 'agente de WhatsApp' from (values
  ('WhatsApp (agente)', 'Enlace medido', 'Portada desde el agente', 'https://www.wiptool.com/agente',
   'Lleva a la portada marcando la visita como del agente de WhatsApp (fuente whatsapp, medio agente, campaña agente_whatsapp).',
   'Resumen › De dónde llegan las visitas, y Sitio web (fuente whatsapp / medio agente).', 'Respuestas del agente de WhatsApp (F16)'),
  ('WhatsApp (agente)', 'Enlace medido', 'Planes de WIP Equipos desde el agente', 'https://www.wiptool.com/agente/planes',
   'Lleva a los planes de la página de equipos (#planes) marcando la visita como del agente (contenido planes).',
   'Resumen › De dónde llegan las visitas (fuente whatsapp / medio agente).', 'Respuestas del agente cuando preguntan por precios de Pymes'),
  ('WhatsApp (agente)', 'Enlace medido', 'Página de equipos desde el agente', 'https://www.wiptool.com/agente/equipos',
   'Lleva a la página de WIP Equipos marcando la visita como del agente (contenido equipos).',
   'Resumen › De dónde llegan las visitas (fuente whatsapp / medio agente).', 'Respuestas del agente a empresas con equipo propio'),
  ('WhatsApp (agente)', 'Enlace medido', 'Soluciones por industria desde el agente', 'https://www.wiptool.com/agente/gruas',
   'Lleva a la página de la industria marcando la visita como del agente. Variantes: /agente/gruas, /agente/asistencias, /agente/telecom, /agente/servicio-tecnico, /agente/domicilio y /agente/campo (el contenido es la industria).',
   'Resumen › De dónde llegan las visitas (fuente whatsapp / medio agente).', 'Respuestas del agente según la industria de la persona')
) as v(plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa)
where not exists (select 1 from accionadores a where a.enlace = v.enlace);
