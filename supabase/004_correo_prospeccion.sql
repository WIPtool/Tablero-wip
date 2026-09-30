-- Tablero WIP · T3: Email marketing (Brevo), Prospección (Explee) y Accionadores.
-- Se corre una vez en el editor SQL de Supabase, después de 001, 002 y 003. Es idempotente.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Campañas masivas de Brevo. "fecha" es el día de envío; las cifras son las acumuladas de la campaña.
create table if not exists brevo_campana (
  fecha       date not null,
  campana_id  text primary key,
  campana     text not null default '',
  asunto      text not null default '',
  enviados    integer not null default 0,
  entregados  integer not null default 0,
  aperturas   integer not null default 0, -- aperturas únicas
  clics       integer not null default 0, -- clics únicos
  desuscritos integer not null default 0,
  rebotes     integer not null default 0
);

-- Correos de las automatizaciones (llegan como transaccionales): mensajes distintos por día, asunto y evento.
-- Eventos de Brevo: requests (enviado), delivered, opened, clicks, hardBounces, softBounces, unsubscribed, loadedByProxy…
create table if not exists brevo_evento_diario (
  fecha    date not null,
  asunto   text not null,
  evento   text not null,
  mensajes integer not null default 0,
  primary key (fecha, asunto, evento)
);

-- A qué automatización pertenece cada asunto (la API pública de Brevo no trae el nombre de la automatización).
-- Se compara el comienzo del asunto, sin mayúsculas. Si se cambia o se agrega un asunto en Brevo, se agrega aquí.
create table if not exists brevo_secuencias (
  asunto    text primary key,
  secuencia text not null
);
insert into brevo_secuencias (asunto, secuencia) values
  ('Tus servicios están a punto de cambiar', 'Pymes - Info solicitada'),
  ('Así resolvió su operación una empresa como la tuya', 'Pymes - Info solicitada'),
  ('¿Y si mi equipo no lo usa?', 'Pymes - Info solicitada'),
  ('Así se ve un lunes cuando ya no operas a ciegas', 'Pymes - Info solicitada'),
  ('¿Tu colaborador no ha llegado al servicio de hoy?', 'Pymes - Info solicitada'),
  ('Tu sesión en vivo de WIP está confirmada', 'Pymes - Demo solicitada'),
  ('Wip, el software para gestión de tus servicios', 'Pymes - Demo completada'),
  ('Lo que siempre nos preguntan en Wip', 'Pymes - Demo completada'),
  ('Otras empresas que usan Wip', 'Pymes - Demo completada'),
  ('Bienvenido al lado de los que ya no operan a ciegas', 'Pymes - Decidió tomar Wip'),
  ('Tu cuenta está a un clic de dejar de operar a ciegas', 'Pymes - Decidió tomar Wip'),
  ('Te ayudo a terminar esto en minutos', 'Pymes - Decidió tomar Wip'),
  ('Tu factura de WIP sigue pendiente', 'Pymes - Factura enviada'),
  ('¿Necesitas ayuda con el pago?', 'Pymes - Factura enviada'),
  ('Ya no operas a ciegas. Esto es lo que sigue.', 'Pymes - Parametrización completada'),
  ('¿Ya registraste tu primer servicio?', 'Pymes - Parametrización completada'),
  ('El hábito que separa a los que ya no operan a ciegas', 'Pymes - Parametrización completada'),
  ('¿Ya dejaste de operar a ciegas del todo?', 'Pymes - Parametrización completada'),
  ('Excel, WhatsApp y llamadas para manejar tus servicios', 'Nutrición - Wip equipos'),
  ('Deja de llamar a tu equipo para saber', 'Nutrición - Wip equipos'),
  ('Asignación inteligente de servicios a tu equipo', 'Nutrición - Wip equipos'),
  ('Ya tienes WIP. Y probablemente lo usas al 10%', 'Automatización #8 (inactiva)'),
  ('Wip el software de los proveedores de asistencia', 'Automatización #8 (inactiva)')
on conflict (asunto) do update set secuencia = excluded.secuencia;

-- Explee: una fila por día y campaña (lo del día, que se actualiza cada hora).
create table if not exists explee_campana_diario (
  fecha      date not null,
  campana_id text not null,
  campana    text not null default '',
  enviados   integer not null default 0,
  respuestas integer not null default 0,
  leads      integer not null default 0, -- leads calientes
  gasto_usd  numeric not null default 0,
  primary key (fecha, campana_id)
);

-- Lo acumulado en Explee antes del registro diario (2026-09-01, igual que la fila "histórico" de la hoja
-- "Explee - Tablero") y lo registrado desde el 28 de septiembre con envíos o respuestas.
insert into explee_campana_diario (fecha, campana_id, campana, enviados, respuestas, leads, gasto_usd) values
  ('2026-09-01', '154686', 'Medical transport ops', 147, 1, 0, 4.41),
  ('2026-09-01', '154690', 'Home care fleets', 95, 1, 1, 2.85),
  ('2026-09-01', '154706', 'assistance and services companies', 2835, 32, 18, 85.05),
  ('2026-09-01', '173513', 'Industrial field contractors', 1268, 11, 6, 38.04),
  ('2026-09-30', '154706', 'assistance and services companies', 0, 1, 0, 0)
on conflict (fecha, campana_id) do nothing;

-- Leads calientes de Explee (se reemplaza la lista completa en cada carga). Datos de contacto: solo los ve el equipo.
create table if not exists explee_lead (
  fecha    date,
  lead_id  text not null default '',
  campana  text not null default '',
  empresa  text not null default '',
  dominio  text not null default '',
  cargo    text not null default '',
  pais     text not null default '',
  motivo   text not null default '',
  nombre   text not null default '',
  correo   text not null default '',
  linkedin text not null default '',
  telefono text not null default '',
  nota     text not null default ''
);

-- Accionadores: todo lo que suma datos en Analytics (enlaces medidos, eventos, datos personalizados). Lo edita el equipo.
create table if not exists accionadores (
  id              bigint generated always as identity primary key,
  plataforma      text not null,
  tipo            text not null,
  accionador      text not null,
  enlace          text not null default '',
  que_hace        text not null default '',
  donde_se_ve     text not null default '',
  donde_se_usa    text not null default '',
  actualizado_por text not null default '',
  actualizado     timestamptz not null default now()
);

-- Lista inicial (la misma de la pestaña "Accionadores" de la hoja, con "dónde se ve" apuntando a este tablero).
insert into accionadores (plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa, actualizado_por)
select v.*, 'carga inicial' from (values
  ('Instagram', 'Enlace medido', 'Instagram (bio y publicaciones)', 'https://www.wiptool.com/ig',
   'Lleva a la portada y marca la visita como Instagram (fuente instagram, medio social, campaña bio). Ponerlo en la bio y en las historias.',
   'Resumen › De dónde llegan las visitas: Redes sociales.', 'Bio y publicaciones de Instagram'),
  ('Instagram', 'Enlace medido', 'Página de equipos desde Instagram', 'https://www.wiptool.com/equipos/ig',
   'Lleva a la página de equipos (GPS) marcando la visita como Instagram (fuente instagram, medio social, campaña bio_equipos).',
   'Resumen › De dónde llegan las visitas: Redes sociales.', 'Bio y publicaciones de Instagram sobre equipos'),
  ('Instagram', 'Enlace medido', 'WhatsApp desde Instagram', 'https://www.wiptool.com/wa-ig',
   'Registra el clic (click_whatsapp con origen instagram) y abre el chat de WhatsApp de WIP con el mensaje "vengo de Instagram", para las etiquetas de WhatsApp Business.',
   'Resumen › Clics a WhatsApp y a la agenda por origen: Instagram.', 'Botones de WhatsApp en Instagram'),
  ('Facebook', 'Enlace medido', 'Facebook (perfil)', 'https://www.wiptool.com/fb',
   'Lleva a la portada y marca la visita como Facebook (fuente facebook, medio social, campaña perfil).',
   'Resumen › De dónde llegan las visitas: Redes sociales.', 'Perfil y publicaciones de Facebook'),
  ('Facebook', 'Enlace medido', 'WhatsApp desde Facebook', 'https://www.wiptool.com/wa-fb',
   'Registra el clic (click_whatsapp con origen facebook) y abre el chat de WhatsApp de WIP con el mensaje "vengo de Facebook".',
   'Resumen › Clics a WhatsApp y a la agenda por origen: Facebook.', 'Botones de WhatsApp en Facebook'),
  ('Meta Ads', 'Enlace medido', 'WhatsApp de anuncios de Meta', 'https://www.wiptool.com/wa',
   'Lleva a la portada marcando la visita como WhatsApp (fuente whatsapp, medio chat, campaña meta_mensajeria). Es el destino de los anuncios de mensajería de Meta.',
   'Resumen › De dónde llegan las visitas: fuente whatsapp.', 'Anuncios de mensajería en Meta'),
  ('Brevo', 'Enlace medido', 'WhatsApp desde correos de Brevo', 'https://www.wiptool.com/wa-email?c=info-2',
   'Registra el clic (click_whatsapp con origen email y el código del correo en ?c=) y abre el chat de WhatsApp con el mensaje "vengo del correo de WIP". El código c identifica el correo de la secuencia.',
   'Email marketing › Clics desde los correos. Resumen › Clics a WhatsApp y a la agenda por origen: Correo (Brevo).', 'Botones y enlaces de WhatsApp en los correos automáticos de Brevo'),
  ('Brevo', 'Enlace medido', 'Agenda desde correos de Brevo', 'https://www.wiptool.com/agenda-email?c=info-2',
   'Registra el clic (click_calendly con origen email y el código del correo) y abre el Calendly de comercial con marcas de Brevo (fuente brevo, medio email, campaña secuencias).',
   'Email marketing › Clics desde los correos. Resumen › Clics a WhatsApp y a la agenda por origen: Correo (Brevo), Agenda.', 'Botones de agendar en los correos automáticos de Brevo'),
  ('Explee', 'Enlace medido', 'Página web desde Explee', 'https://www.wiptool.com/explee/industrial',
   'Lleva a la portada con marcas de Explee (fuente explee, medio email, campaña prospeccion). El texto final es la campaña y se guarda como utm_content. Sin campaña: https://www.wiptool.com/explee',
   'Prospección › Visitas desde Explee por campaña. Resumen › De dónde llegan las visitas: Explee (prospección).', 'Correos de prospección en frío de Explee (campañas: industrial, asistencias, transporte-medico, muestras, hospitales, dialisis, home-care, logistica)'),
  ('Explee', 'Enlace medido', 'Página de equipos desde Explee', 'https://www.wiptool.com/equipos/explee/industrial',
   'Lleva a la página de equipos (GPS) con marcas de Explee (fuente explee, medio email, campaña prospeccion) y la campaña como utm_content. Sin campaña: https://www.wiptool.com/equipos/explee',
   'Prospección › Visitas desde Explee por campaña.', 'Correos de Explee para clientes que buscan equipos (GPS)'),
  ('Explee', 'Enlace medido', 'Agenda desde Explee', 'https://www.wiptool.com/agenda-explee/industrial',
   'Registra el clic (click_calendly con origen explee y la campaña) y abre el Calendly de comercial con marcas de Explee (fuente explee, medio email, campaña prospeccion). Sin campaña: https://www.wiptool.com/agenda-explee',
   'Prospección › Clics a la agenda desde Explee. Resumen › Clics a WhatsApp y a la agenda por origen: Explee.', 'Correos de prospección en frío de Explee (mismas campañas)'),
  ('App SBS vieja', 'Enlace medido', 'App SBS vieja', 'https://www.wiptool.com/landing/sbs',
   'Enlace de la app vieja de SBS (ya no está en Play Store, pero la gente la tiene). Redirige a la portada con la marca app_sbs_vieja y sin llevar la placa, que es un dato personal.',
   'Resumen › De dónde llegan las visitas: APP SBS vieja.', 'No se comparte: lo abre la app vieja de SBS'),
  ('WhatsApp (App sin app)', 'Enlace medido', 'App sin app (Powered by WIP)', 'https://www.wiptool.com/herramientas/experiencia-app-sin-app/?utm_source=Referral&utm_medium=Powered-by-wip&utm_campaign=Campa%C3%B1a-experiencia-app-sin-app&utm_term=%5BNombre%20del%20cliente%5D',
   'Enlace del mensaje de WhatsApp que reciben los clientes finales para ver su servicio en tiempo real. Lleva a la sección de WhatsApp de la portada. El utm_term entre corchetes es la empresa cliente.',
   'Resumen › De dónde llegan las visitas: App sin app, y tabla "App sin app por cliente".', 'Mensaje de WhatsApp "experiencia app sin app" de cada cliente'),
  ('Sitio web', 'Evento del sitio', 'click_whatsapp', 'https://www.wiptool.com/',
   'Clic en cualquier botón de WhatsApp del sitio o de los enlaces medidos. Es un evento clave (conversión) en Analytics.',
   'Resumen › Conversiones por tipo, y Clics a WhatsApp y a la agenda por origen.', 'Sitio web y enlaces /wa-*'),
  ('Sitio web', 'Evento del sitio', 'click_calendly', 'https://www.wiptool.com/',
   'Clic en un botón para agendar una reunión (sitio web y enlaces /agenda-*). Es un evento clave en Analytics.',
   'Resumen › Conversiones por tipo, y Clics a WhatsApp y a la agenda por origen.', 'Sitio web y enlaces /agenda-*'),
  ('Sitio web', 'Evento del sitio', 'calendly_agendado', 'https://www.wiptool.com/#contacto',
   'La persona termina de agendar en Calendly (Calendly avisa a la página). Es la conversión real de la agenda. Pendiente: marcarlo como evento clave en Analytics después de la primera cita.',
   'Resumen › Citas agendadas por origen.', 'Sección de contacto de la portada, blog, soluciones y contacto'),
  ('Sitio web', 'Evento del sitio', 'formulario_contacto', 'https://www.wiptool.com/contacto',
   'Envío del formulario de contacto. Es un evento clave en Analytics.', 'Resumen › Conversiones por tipo.', 'Páginas de contacto y portada'),
  ('Sitio web', 'Evento del sitio', 'generate_lead', 'https://www.wiptool.com/contacto',
   'Lead generado: formulario de contacto (lead_source contacto) o descarga de un ebook (lead_source ebook, con el nombre del ebook). Ebooks: https://www.wiptool.com/ebook',
   'Analytics (informe de eventos).', 'Contacto y ebooks'),
  ('Sitio web', 'Evento del sitio', 'inscripcion_enviada', 'https://www.wiptool.com/inscripcion',
   'Envío del formulario de inscripción a un plan de WIP. Es un evento clave en Analytics.', 'Resumen › Conversiones por tipo.', 'Página de inscripción'),
  ('Sitio web', 'Evento del sitio', 'blog_cta_click', 'https://www.wiptool.com/blog',
   'Clic en un botón de invitación dentro de un artículo del blog (guarda cuál botón y a dónde lleva).', 'Analytics (informe de eventos).', 'Artículos del blog'),
  ('Sitio web', 'Evento del sitio', 'search', 'https://www.wiptool.com/blog',
   'Búsqueda dentro del blog (guarda el texto buscado).', 'Analytics (informe de eventos).', 'Buscador del blog'),
  ('Sitio web', 'Evento del sitio', 'academy_video_play', 'https://www.wiptool.com/academy',
   'Reproducción de un video de la Academy (guarda el curso y la lección).', 'Analytics (informe de eventos).', 'Academy'),
  ('Google Analytics', 'Dato personalizado de Analytics', 'Origen WhatsApp', 'https://analytics.google.com/analytics/web/#/a242054715p333145660/admin/customdefinitions',
   'Dimensión de Analytics con el parámetro "origen" de click_whatsapp, click_calendly y calendly_agendado (instagram, facebook, email, explee). Sin valor = clic hecho en el sitio web.',
   'Resumen › Clics a WhatsApp y a la agenda por origen, y Citas agendadas por origen.', 'Analytics › Administrar › Definiciones personalizadas'),
  ('Google Analytics', 'Dato personalizado de Analytics', 'Correo de origen', 'https://analytics.google.com/analytics/web/#/a242054715p333145660/admin/customdefinitions',
   'Dimensión de Analytics con el parámetro "correo": el código del correo de la secuencia de Brevo, o la campaña de Explee, que va en ?c= de los enlaces.',
   'Email marketing › Clics desde los correos. Prospección › Clics a la agenda desde Explee.', 'Analytics › Administrar › Definiciones personalizadas')
) as v(plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa)
where not exists (select 1 from accionadores);

-- ---------------------------------------------------------------------------
-- Seguridad: el equipo lee todo; los accionadores y los asuntos de Brevo además los puede editar.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['brevo_campana','brevo_evento_diario','brevo_secuencias','explee_campana_diario','explee_lead','accionadores'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists solo_equipo on %I', t);
    execute format('create policy solo_equipo on %I for select to authenticated using (es_equipo_wip())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

drop policy if exists equipo_edita on accionadores;
create policy equipo_edita on accionadores for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip());
drop policy if exists equipo_edita on brevo_secuencias;
create policy equipo_edita on brevo_secuencias for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip());

-- ---------------------------------------------------------------------------
-- Carga: tablas nuevas a las que puede escribir n8n.
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
                     'brevo_campana','brevo_evento_diario','explee_campana_diario','explee_lead') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  if p_tabla = 'explee_lead' then
    delete from explee_lead where true; -- la lista completa se reemplaza en cada carga (Supabase exige un WHERE)
  elsif p_sitio is null then
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
-- Inversión diaria: se suma el gasto de Explee (en dólares, pasado a pesos con la TRM del día).
-- ---------------------------------------------------------------------------
create or replace function inversion_diaria(p_desde date, p_hasta date)
returns table (fecha date, plataforma text, cop numeric)
language sql stable as $$
  select m.fecha, 'Meta', sum(a_pesos(m.inversion, m.moneda, m.fecha))
    from meta_campana_diario m where m.fecha between p_desde and p_hasta group by m.fecha
  union all
  select g.fecha, 'Google Ads', sum(a_pesos(g.inversion, g.moneda, g.fecha))
    from gads_campana_diario g where g.fecha between p_desde and p_hasta group by g.fecha
  union all
  select e.fecha, 'Explee', sum(a_pesos(e.gasto_usd, 'USD', e.fecha))
    from explee_campana_diario e where e.fecha between p_desde and p_hasta group by e.fecha
  union all
  select d.dia, c.plataforma,
         a_pesos(c.monto / extract(day from (date_trunc('month', d.dia) + interval '1 month - 1 day'))::numeric, c.moneda, d.dia)
    from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
    join costos_fijos c on d.dia >= c.desde and (c.hasta is null or d.dia <= c.hasta)
$$;

-- ---------------------------------------------------------------------------
-- Email marketing (Brevo)
-- ---------------------------------------------------------------------------
-- Automatización a la que pertenece un asunto.
create or replace function secuencia_brevo(p_asunto text) returns text
language sql stable as $$
  select coalesce((select s.secuencia from brevo_secuencias s
                   where lower(btrim(p_asunto)) like lower(btrim(s.asunto)) || '%'
                   order by length(s.asunto) desc limit 1), 'Otra (asunto anterior)')
$$;

create or replace function tablero_email(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  a_hasta date := p_desde - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'enviados',       coalesce(sum(mensajes) filter (where evento = 'requests' and fecha >= p_desde), 0),
        'enviados_ant',   coalesce(sum(mensajes) filter (where evento = 'requests' and fecha < p_desde), 0),
        'entregados',     coalesce(sum(mensajes) filter (where evento = 'delivered' and fecha >= p_desde), 0),
        'entregados_ant', coalesce(sum(mensajes) filter (where evento = 'delivered' and fecha < p_desde), 0),
        'aperturas',      coalesce(sum(mensajes) filter (where evento = 'opened' and fecha >= p_desde), 0),
        'aperturas_ant',  coalesce(sum(mensajes) filter (where evento = 'opened' and fecha < p_desde), 0),
        'clics',          coalesce(sum(mensajes) filter (where evento = 'clicks' and fecha >= p_desde), 0),
        'clics_ant',      coalesce(sum(mensajes) filter (where evento = 'clicks' and fecha < p_desde), 0),
        'inversion',      (select coalesce(round(sum(cop)), 0) from inversion_diaria(p_desde, p_hasta) where lower(plataforma) = 'brevo'),
        'inversion_ant',  (select coalesce(round(sum(cop)), 0) from inversion_diaria(a_desde, a_hasta) where lower(plataforma) = 'brevo')
      )
      from brevo_evento_diario where fecha between a_desde and p_hasta
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'enviados', coalesce(x.env, 0), 'aperturas', coalesce(x.ap, 0),
                                                   'clics', coalesce(x.cl, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
      left join (select fecha, sum(mensajes) filter (where evento = 'requests') env, sum(mensajes) filter (where evento = 'opened') ap,
                        sum(mensajes) filter (where evento = 'clicks') cl
                 from brevo_evento_diario where fecha between p_desde and p_hasta group by fecha) x on x.fecha = d.dia
    ),
    'secuencias', (
      select coalesce(jsonb_agg(jsonb_build_object('secuencia', secuencia, 'enviados', env, 'entregados', ent, 'aperturas', ap, 'clics', cl,
                                                    'tasa_apertura', case when ent > 0 then ap::numeric / ent end,
                                                    'tasa_clics', case when ent > 0 then cl::numeric / ent end) order by env desc), '[]'::jsonb)
      from (select secuencia_brevo(asunto) secuencia,
                   sum(mensajes) filter (where evento = 'requests') env, sum(mensajes) filter (where evento = 'delivered') ent,
                   sum(mensajes) filter (where evento = 'opened') ap, sum(mensajes) filter (where evento = 'clicks') cl
            from brevo_evento_diario where fecha between p_desde and p_hasta group by 1) x
    ),
    'correos', (
      select coalesce(jsonb_agg(jsonb_build_object('asunto', asunto, 'secuencia', secuencia_brevo(asunto), 'enviados', env, 'aperturas', ap, 'clics', cl,
                                                    'tasa_apertura', case when ent > 0 then ap::numeric / ent end) order by env desc), '[]'::jsonb)
      from (select asunto,
                   coalesce(sum(mensajes) filter (where evento = 'requests'), 0) env, coalesce(sum(mensajes) filter (where evento = 'delivered'), 0) ent,
                   coalesce(sum(mensajes) filter (where evento = 'opened'), 0) ap, coalesce(sum(mensajes) filter (where evento = 'clicks'), 0) cl
            from brevo_evento_diario where fecha between p_desde and p_hasta group by 1) x
    ),
    'campanas', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'campana', campana, 'enviados', enviados, 'entregados', entregados,
                                                    'aperturas', aperturas, 'clics', clics, 'desuscritos', desuscritos,
                                                    'tasa_apertura', case when entregados > 0 then aperturas::numeric / entregados end,
                                                    'tasa_clics', case when entregados > 0 then clics::numeric / entregados end) order by fecha desc), '[]'::jsonb)
      from brevo_campana where fecha between p_desde and p_hasta
    ),
    'clics_desde_correos', (
      select coalesce(jsonb_agg(jsonb_build_object('correo', correo, 'clic_a', clic_a, 'clics', e, 'personas', p) order by e desc), '[]'::jsonb)
      from (select coalesce(nullif(correo, ''), '(sin código)') correo,
                   case evento when 'click_calendly' then 'Agenda' else 'WhatsApp' end clic_a, sum(eventos) e, sum(personas) p
            from ga4_evento_diario
            where fecha between p_desde and p_hasta and lower(origen) = 'email' and evento in ('click_whatsapp', 'click_calendly')
            group by 1, 2) x
    ),
    'visitas_desde_correos', (
      select coalesce(jsonb_agg(jsonb_build_object('correo', correo, 'visitas', v, 'conversiones', c) order by v desc), '[]'::jsonb)
      from (select coalesce(nullif(contenido, ''), nullif(campana, ''), '(sin marca)') correo, sum(visitas) v, sum(conversiones) c
            from ga4_canal_diario
            where fecha between p_desde and p_hasta and lower(fuente) in ('brevo', 'sendinblue') group by 1) x
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Prospección (Explee)
-- ---------------------------------------------------------------------------
create or replace function tablero_prospeccion(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  a_hasta date := p_desde - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'enviados',       coalesce(sum(enviados) filter (where fecha >= p_desde), 0),
        'enviados_ant',   coalesce(sum(enviados) filter (where fecha < p_desde), 0),
        'respuestas',     coalesce(sum(respuestas) filter (where fecha >= p_desde), 0),
        'respuestas_ant', coalesce(sum(respuestas) filter (where fecha < p_desde), 0),
        'gasto',          coalesce(round(sum(a_pesos(gasto_usd, 'USD', fecha)) filter (where fecha >= p_desde)), 0),
        'gasto_ant',      coalesce(round(sum(a_pesos(gasto_usd, 'USD', fecha)) filter (where fecha < p_desde)), 0),
        'gasto_usd',      coalesce(sum(gasto_usd) filter (where fecha >= p_desde), 0),
        'leads',          (select count(*) from explee_lead where fecha between p_desde and p_hasta),
        'leads_ant',      (select count(*) from explee_lead where fecha between a_desde and a_hasta)
      )
      from explee_campana_diario where fecha between a_desde and p_hasta
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'enviados', coalesce(x.env, 0), 'respuestas', coalesce(x.resp, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
      left join (select fecha, sum(enviados) env, sum(respuestas) resp from explee_campana_diario
                 where fecha between p_desde and p_hasta group by fecha) x on x.fecha = d.dia
    ),
    'campanas', (
      select coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'enviados', env, 'respuestas', resp, 'leads', leads,
                                                    'tasa_respuesta', case when env > 0 then resp::numeric / env end,
                                                    'gasto', round(gasto), 'costo_lead', case when leads > 0 then round(gasto / leads) end) order by env desc), '[]'::jsonb)
      from (select max(campana) campana, sum(enviados) env, sum(respuestas) resp, sum(leads) leads, sum(a_pesos(gasto_usd, 'USD', fecha)) gasto
            from explee_campana_diario where fecha between p_desde and p_hasta group by campana_id) x
    ),
    'leads', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'campana', campana, 'empresa', empresa, 'cargo', cargo, 'pais', pais,
                                                    'nombre', nombre, 'correo', correo, 'telefono', telefono, 'linkedin', linkedin,
                                                    'motivo', motivo) order by fecha desc nulls last), '[]'::jsonb)
      from explee_lead where fecha between p_desde and p_hasta
    ),
    'agenda_por_campana', (
      select coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'clics', e, 'personas', p) order by e desc), '[]'::jsonb)
      from (select coalesce(nullif(correo, ''), '(sin campaña)') campana, sum(eventos) e, sum(personas) p
            from ga4_evento_diario
            where fecha between p_desde and p_hasta and evento = 'click_calendly' and lower(origen) = 'explee' group by 1) x
    ),
    'visitas_por_campana', (
      select coalesce(jsonb_agg(jsonb_build_object('campana', campana, 'visitas', v, 'conversiones', c) order by v desc), '[]'::jsonb)
      from (select coalesce(nullif(contenido, ''), '(sin campaña)') campana, sum(visitas) v, sum(conversiones) c
            from ga4_canal_diario
            where fecha between p_desde and p_hasta and lower(fuente) like '%explee%' group by 1) x
    )
  );
end $$;

revoke all on function tablero_email(date, date) from anon;
revoke all on function tablero_prospeccion(date, date) from anon;
