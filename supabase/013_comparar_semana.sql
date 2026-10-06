-- Comparación con los mismos días de la semana anterior (2026-10-05).
-- Las funciones del tablero con periodo anterior aceptan p_comparar: el día en que empieza el periodo de comparación
-- (misma duración que el actual). Si no se envía, se compara con los días inmediatamente anteriores, como antes.
-- El tablero lo envía solo en "Esta semana": de lunes a ayer, comparado con los mismos días de la semana pasada.
-- Generado a partir de las definiciones anteriores (002, 003, 004, 005 y 012) con los cambios mínimos.

drop function if exists tablero_resumen(date, date);
create or replace function tablero_resumen(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
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
revoke all on function tablero_resumen(date, date, date) from anon;

drop function if exists tablero_seo(date, date, text);
create or replace function tablero_seo(p_desde date, p_hasta date, p_sitio text, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
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
revoke all on function tablero_seo(date, date, text, date) from anon;

drop function if exists tablero_pauta(date, date);
create or replace function tablero_pauta(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
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
revoke all on function tablero_pauta(date, date, date) from anon;

drop function if exists tablero_inversion(date, date);
create or replace function tablero_inversion(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare n int := p_hasta - p_desde + 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'total',     (select coalesce(round(sum(cop)), 0) from inversion_diaria(p_desde, p_hasta)),
    'total_ant', (select coalesce(round(sum(cop)), 0) from inversion_diaria(coalesce(p_comparar, p_desde - n), coalesce(p_comparar, p_desde - n) + n - 1))
  );
end $$;
revoke all on function tablero_inversion(date, date, date) from anon;

drop function if exists tablero_email(date, date);
create or replace function tablero_email(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'enviados',       coalesce(sum(mensajes) filter (where evento = 'requests' and fecha >= p_desde), 0),
        'enviados_ant',   coalesce(sum(mensajes) filter (where evento = 'requests' and fecha <= a_hasta), 0),
        'entregados',     coalesce(sum(mensajes) filter (where evento = 'delivered' and fecha >= p_desde), 0),
        'entregados_ant', coalesce(sum(mensajes) filter (where evento = 'delivered' and fecha <= a_hasta), 0),
        'aperturas',      coalesce(sum(mensajes) filter (where evento = 'opened' and fecha >= p_desde), 0),
        'aperturas_ant',  coalesce(sum(mensajes) filter (where evento = 'opened' and fecha <= a_hasta), 0),
        'clics',          coalesce(sum(mensajes) filter (where evento = 'clicks' and fecha >= p_desde), 0),
        'clics_ant',      coalesce(sum(mensajes) filter (where evento = 'clicks' and fecha <= a_hasta), 0),
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
revoke all on function tablero_email(date, date, date) from anon;

drop function if exists tablero_prospeccion(date, date);
create or replace function tablero_prospeccion(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', (
      select jsonb_build_object(
        'enviados',       coalesce(sum(enviados) filter (where fecha >= p_desde), 0),
        'enviados_ant',   coalesce(sum(enviados) filter (where fecha <= a_hasta), 0),
        'respuestas',     coalesce(sum(respuestas) filter (where fecha >= p_desde), 0),
        'respuestas_ant', coalesce(sum(respuestas) filter (where fecha <= a_hasta), 0),
        'gasto',          coalesce(round(sum(a_pesos(gasto_usd, 'USD', fecha)) filter (where fecha >= p_desde)), 0),
        'gasto_ant',      coalesce(round(sum(a_pesos(gasto_usd, 'USD', fecha)) filter (where fecha <= a_hasta)), 0),
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
revoke all on function tablero_prospeccion(date, date, date) from anon;

drop function if exists tablero_embudo(date, date);
create or replace function tablero_embudo(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
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
revoke all on function tablero_embudo(date, date, date) from anon;

drop function if exists tablero_agente(date, date);
create or replace function tablero_agente(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n int := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := a_desde + n - 1;
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
        count(distinct lead_id) filter (where rol = 'cliente' and dia <= a_hasta) as conversaciones_ant,
        count(*) filter (where rol = 'cliente' and dia >= p_desde) as recibidos,
        count(*) filter (where rol = 'cliente' and dia <= a_hasta) as recibidos_ant,
        count(*) filter (where rol = 'agente' and dia >= p_desde) as respuestas,
        count(*) filter (where rol = 'agente' and dia <= a_hasta) as respuestas_ant
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
          'reuniones_ant', (select count(*) from atendidas where dia <= a_hasta and reunion)) from k),
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
revoke all on function tablero_agente(date, date, date) from anon;
