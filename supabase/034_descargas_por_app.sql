-- Operaciones › Descargas de la app (2026-11-10): la cuenta de App Store tiene varias apps (WIP Colaboradores y las de
-- SBS), así que tablero_descargas también devuelve el detalle por app y tienda (por_app).
create or replace function tablero_descargas(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n       int  := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := coalesce(p_comparar, p_desde - n) + n - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'ultimo_dia', (select jsonb_build_object('android', max(fecha) filter (where tienda = 'android'),
                                             'ios', max(fecha) filter (where tienda = 'ios')) from app_descarga_diaria),
    'kpis', (
      select jsonb_build_object(
        'descargas',            coalesce(sum(descargas) filter (where actual), 0),
        'descargas_ant',        coalesce(sum(descargas) filter (where not actual), 0),
        'android',              coalesce(sum(descargas) filter (where actual and tienda = 'android'), 0),
        'android_ant',          coalesce(sum(descargas) filter (where not actual and tienda = 'android'), 0),
        'ios',                  coalesce(sum(descargas) filter (where actual and tienda = 'ios'), 0),
        'ios_ant',              coalesce(sum(descargas) filter (where not actual and tienda = 'ios'), 0),
        'actualizaciones',      coalesce(sum(actualizaciones) filter (where actual), 0),
        'actualizaciones_ant',  coalesce(sum(actualizaciones) filter (where not actual), 0),
        'desinstalaciones',     coalesce(sum(desinstalaciones) filter (where actual), 0),
        'desinstalaciones_ant', coalesce(sum(desinstalaciones) filter (where not actual), 0),
        'por_dia',              round(coalesce(sum(descargas) filter (where actual), 0)::numeric / n),
        'por_dia_ant',          round(coalesce(sum(descargas) filter (where not actual), 0)::numeric / n))
      from (select *, fecha between p_desde and p_hasta actual from app_descarga_diaria
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta) x
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'android', coalesce(s.android, 0), 'ios', coalesce(s.ios, 0),
                                                   'total', coalesce(s.android, 0) + coalesce(s.ios, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date dia) d
      left join (select fecha, sum(descargas) filter (where tienda = 'android') android, sum(descargas) filter (where tienda = 'ios') ios
                 from app_descarga_diaria where fecha between p_desde and p_hasta group by fecha) s on s.fecha = d.dia
    ),
    'por_app', (
      select coalesce(jsonb_agg(jsonb_build_object('app', app, 'tienda', tienda, 'descargas', act, 'descargas_ant', ant, 'actualizaciones', upd)
                                order by act desc, ant desc), '[]'::jsonb)
      from (select app, tienda,
                   coalesce(sum(descargas) filter (where fecha between p_desde and p_hasta), 0) act,
                   coalesce(sum(descargas) filter (where fecha between a_desde and a_hasta), 0) ant,
                   coalesce(sum(actualizaciones) filter (where fecha between p_desde and p_hasta), 0) upd
            from app_descarga_diaria
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta group by 1, 2) x
      where act + ant + upd > 0
    ),
    'por_pais', (
      select coalesce(jsonb_agg(jsonb_build_object('pais', pais, 'descargas', android + ios, 'android', android, 'ios', ios, 'descargas_ant', ant)
                                order by android + ios desc, ant desc), '[]'::jsonb)
      from (select coalesce(nullif(pais, ''), 'Sin país') pais,
                   coalesce(sum(descargas) filter (where fecha between p_desde and p_hasta and tienda = 'android'), 0) android,
                   coalesce(sum(descargas) filter (where fecha between p_desde and p_hasta and tienda = 'ios'), 0) ios,
                   coalesce(sum(descargas) filter (where fecha between a_desde and a_hasta), 0) ant
            from app_descarga_diaria
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta group by 1) x
      where android + ios + ant > 0
    )
  );
end $$;
revoke all on function tablero_descargas(date, date, date) from anon;
