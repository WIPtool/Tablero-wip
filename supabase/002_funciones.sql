-- Tablero WIP: funciones que usa el tablero para leer (una por página).
-- Devuelven JSON ya agregado para el periodo pedido y el periodo anterior de igual duración.
-- Corren con los permisos de quien consulta, así que las reglas de seguridad (solo @wiptool.com) aplican.

-- Nombre del canal como se muestra en el tablero (GA4 los entrega en inglés).
create or replace function canal_wip(p_canal text, p_fuente text, p_medio text) returns text
language sql immutable as $$
  select case
    when lower(p_fuente) like '%explee%'                then 'Explee (prospección)'
    when lower(p_fuente) = 'app_sbs_vieja'              then 'APP SBS vieja'
    when lower(p_medio) = 'powered-by-wip'              then 'App sin app'
    when lower(p_fuente) in ('brevo', 'sendinblue')     then 'Correo (Brevo)'
    when p_canal = 'Direct'          then 'Directo'
    when p_canal = 'Organic Search'  then 'Google orgánico'
    when p_canal = 'Organic Social'  then 'Redes sociales'
    when p_canal = 'Organic Video'   then 'Video orgánico'
    when p_canal = 'Paid Search'     then 'Google Ads'
    when p_canal = 'Paid Social'     then 'Redes sociales (pauta)'
    when p_canal = 'Cross-network'   then 'Google Ads (varias redes)'
    when p_canal = 'Display'         then 'Display'
    when p_canal = 'Referral'        then 'Otros sitios'
    when p_canal = 'Email'           then 'Correo'
    when p_canal = 'AI Assistant'    then 'Asistentes de IA'
    when p_canal = 'Unassigned'      then 'Sin asignar'
    when p_canal = ''                then 'Sin asignar'
    else p_canal
  end
$$;

-- Origen de un clic medido (parámetro "origen" de click_whatsapp, click_calendly y calendly_agendado).
create or replace function origen_wip(p_origen text) returns text
language sql immutable as $$
  select case lower(coalesce(p_origen, ''))
    when 'instagram' then 'Instagram'
    when 'facebook'  then 'Facebook'
    when 'email'     then 'Correo (Brevo)'
    when 'explee'    then 'Explee'
    when ''          then 'Sitio web'
    when 'sitio_web' then 'Sitio web'
    when '(not set)' then 'Sitio web'
    else initcap(p_origen)
  end
$$;

create or replace function exigir_equipo() returns void
language plpgsql stable as $$
begin
  if not es_equipo_wip() then raise exception 'Solo cuentas @wiptool.com' using errcode = '42501'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Resumen
-- ---------------------------------------------------------------------------
create or replace function tablero_resumen(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  a_hasta date := p_desde - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'visitas',          (select coalesce(sum(visitas), 0)      from ga4_canal_diario where fecha between p_desde and p_hasta),
      'visitas_ant',      (select coalesce(sum(visitas), 0)      from ga4_canal_diario where fecha between a_desde and a_hasta),
      'conversiones',     (select coalesce(sum(conversiones), 0) from ga4_canal_diario where fecha between p_desde and p_hasta),
      'conversiones_ant', (select coalesce(sum(conversiones), 0) from ga4_canal_diario where fecha between a_desde and a_hasta),
      'clics_google',     (select coalesce(sum(clics), 0)        from gsc_pagina_diario where sitio = 'wiptool.com' and fecha between p_desde and p_hasta),
      'clics_google_ant', (select coalesce(sum(clics), 0)        from gsc_pagina_diario where sitio = 'wiptool.com' and fecha between a_desde and a_hasta),
      'impresiones',      (select coalesce(sum(impresiones), 0)  from gsc_pagina_diario where sitio = 'wiptool.com' and fecha between p_desde and p_hasta),
      'impresiones_ant',  (select coalesce(sum(impresiones), 0)  from gsc_pagina_diario where sitio = 'wiptool.com' and fecha between a_desde and a_hasta)
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'visitas', coalesce(v.visitas, 0),
                                                   'conversiones', coalesce(v.conversiones, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date as dia) d
      left join (select fecha, sum(visitas) visitas, sum(conversiones) conversiones
                 from ga4_canal_diario where fecha between p_desde and p_hasta group by fecha) v on v.fecha = d.dia
    ),
    'conversiones_por_tipo', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', evento, 'conversiones', c) order by c desc), '[]'::jsonb)
      from (select evento, sum(conversiones) c from ga4_evento_diario
            where fecha between p_desde and p_hasta group by evento having sum(conversiones) > 0) x
    ),
    'canales', (
      select coalesce(jsonb_agg(jsonb_build_object('canal', canal, 'visitas', v, 'conversiones', c) order by v desc, c desc), '[]'::jsonb)
      from (select canal_wip(canal, fuente, medio) canal, sum(visitas) v, sum(conversiones) c
            from ga4_canal_diario where fecha between p_desde and p_hasta group by 1) x
    ),
    'clics_por_origen', (
      select coalesce(jsonb_agg(jsonb_build_object('origen', origen, 'clic_a', clic_a, 'clics', e, 'personas', p) order by e desc), '[]'::jsonb)
      from (select origen_wip(origen) origen,
                   case evento when 'click_calendly' then 'Agenda' else 'WhatsApp' end clic_a,
                   sum(eventos) e, sum(personas) p
            from ga4_evento_diario
            where fecha between p_desde and p_hasta and evento in ('click_whatsapp', 'click_calendly')
            group by 1, 2) x
    ),
    'citas_por_origen', (
      select coalesce(jsonb_agg(jsonb_build_object('origen', origen, 'citas', e, 'personas', p) order by e desc), '[]'::jsonb)
      from (select origen_wip(origen) origen, sum(eventos) e, sum(personas) p
            from ga4_evento_diario
            where fecha between p_desde and p_hasta and evento = 'calendly_agendado' group by 1) x
    ),
    'app_sin_app', (
      select coalesce(jsonb_agg(jsonb_build_object('cliente', cliente, 'visitas', v, 'conversiones', c) order by v desc), '[]'::jsonb)
      from (select case when termino in ('', '(not set)', '(not provided)') then 'Sin cliente'
                        else btrim(termino, '[] ') end cliente,
                   sum(visitas) v, sum(conversiones) c
            from ga4_canal_diario
            where fecha between p_desde and p_hasta and lower(medio) = 'powered-by-wip' group by 1) x
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Sitio web
-- ---------------------------------------------------------------------------
create or replace function tablero_sitio(p_desde date, p_hasta date) returns jsonb
language plpgsql stable as $$
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'paginas', (
      select coalesce(jsonb_agg(jsonb_build_object('pagina', pagina, 'visitas', v, 'conversiones', c) order by v desc, c desc), '[]'::jsonb)
      from (select pagina, sum(visitas) v, sum(conversiones) c from ga4_pagina_diario
            where fecha between p_desde and p_hasta group by 1 order by 2 desc limit 50) x
    ),
    'paises', (
      select coalesce(jsonb_agg(jsonb_build_object('pais', pais, 'visitas', v, 'conversiones', c) order by v desc), '[]'::jsonb)
      from (select pais, sum(visitas) v, sum(conversiones) c from ga4_audiencia_diario
            where fecha between p_desde and p_hasta group by 1 order by 2 desc limit 30) x
    ),
    'dispositivos', (
      select coalesce(jsonb_agg(jsonb_build_object('dispositivo', d, 'visitas', v, 'conversiones', c) order by v desc), '[]'::jsonb)
      from (select case dispositivo when 'desktop' then 'Computador' when 'mobile' then 'Celular'
                                    when 'tablet' then 'Tableta' else initcap(dispositivo) end d,
                   sum(visitas) v, sum(conversiones) c
            from ga4_audiencia_diario where fecha between p_desde and p_hasta group by 1) x
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- SEO (p_sitio = 'wiptool.com' o 'platform.wiptool.com')
-- La serie llega hasta el último día que Google ya publicó (va 2 o 3 días atrás).
-- ---------------------------------------------------------------------------
create or replace function tablero_seo(p_desde date, p_hasta date, p_sitio text) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := p_desde - n;
  a_hasta date := p_desde - 1;
  ultimo date;
begin
  perform exigir_equipo();
  select max(fecha) into ultimo from gsc_pagina_diario where sitio = p_sitio;
  return jsonb_build_object(
    'ultimo_dia', ultimo,
    'kpis', (
      select jsonb_build_object(
        'clics', coalesce(sum(clics) filter (where fecha >= p_desde), 0),
        'impresiones', coalesce(sum(impresiones) filter (where fecha >= p_desde), 0),
        'posicion', sum(pos_x_imp) filter (where fecha >= p_desde) / nullif(sum(impresiones) filter (where fecha >= p_desde), 0),
        'clics_ant', coalesce(sum(clics) filter (where fecha <= a_hasta), 0),
        'impresiones_ant', coalesce(sum(impresiones) filter (where fecha <= a_hasta), 0),
        'posicion_ant', sum(pos_x_imp) filter (where fecha <= a_hasta) / nullif(sum(impresiones) filter (where fecha <= a_hasta), 0))
      from gsc_pagina_diario where sitio = p_sitio and fecha between a_desde and p_hasta
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'clics', coalesce(v.clics, 0),
                                                   'impresiones', coalesce(v.impresiones, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, least(p_hasta, coalesce(ultimo, p_hasta)), interval '1 day')::date as dia) d
      left join (select fecha, sum(clics) clics, sum(impresiones) impresiones from gsc_pagina_diario
                 where sitio = p_sitio and fecha between p_desde and p_hasta group by fecha) v on v.fecha = d.dia
    ),
    'consultas', (
      select coalesce(jsonb_agg(jsonb_build_object('consulta', consulta, 'clics', c, 'impresiones', i, 'posicion', p) order by c desc, i desc), '[]'::jsonb)
      from (select consulta, sum(clics) c, sum(impresiones) i, sum(pos_x_imp) / nullif(sum(impresiones), 0) p
            from gsc_consulta_diario where sitio = p_sitio and fecha between p_desde and p_hasta
            group by 1 order by 2 desc, 3 desc limit 100) x
    ),
    'paginas', (
      select coalesce(jsonb_agg(jsonb_build_object('pagina', pagina, 'clics', c, 'impresiones', i, 'posicion', p) order by c desc, i desc), '[]'::jsonb)
      from (select pagina, sum(clics) c, sum(impresiones) i, sum(pos_x_imp) / nullif(sum(impresiones), 0) p
            from gsc_pagina_diario where sitio = p_sitio and fecha between p_desde and p_hasta
            group by 1 order by 2 desc, 3 desc limit 100) x
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Estado de las cargas
-- ---------------------------------------------------------------------------
create or replace function tablero_estado() returns jsonb
language plpgsql stable as $$
begin
  perform exigir_equipo();
  return (select coalesce(jsonb_agg(to_jsonb(c) order by fuente), '[]'::jsonb) from cargas c);
end $$;

revoke all on function tablero_resumen(date, date) from anon;
revoke all on function tablero_sitio(date, date) from anon;
revoke all on function tablero_seo(date, date, text) from anon;
revoke all on function tablero_estado() from anon;
