-- Operaciones › Descargas de la app (2026-11-10): descargas de la app WIP en Google Play (Android) y App Store (iOS).
-- Una Lambda diaria (aws/descargas_apps.mjs) lee los informes de cada tienda: Google Play los deja en su bucket de
-- Cloud Storage (stats/installs, por país) y App Store Connect los da por su API de Sales Reports (resumen diario).
-- Cada carga reemplaza los últimos días, porque las tiendas corrigen sus cifras de días anteriores.
create table if not exists app_descarga_diaria (
  fecha             date not null,             -- día del informe de la tienda
  tienda            text not null,             -- 'android' | 'ios'
  app               text not null default '',  -- paquete de Android o nombre de la app en iOS
  pais              text not null default '',  -- código de país (CO, MX…)
  descargas         integer not null default 0, -- instalaciones nuevas (Android: Daily User Installs; iOS: unidades de descarga)
  actualizaciones   integer not null default 0,
  desinstalaciones  integer not null default 0, -- solo Android (Apple no las informa)
  primary key (fecha, tienda, app, pais)
);
do $$
begin
  execute 'alter table app_descarga_diaria enable row level security';
  execute 'drop policy if exists solo_equipo on app_descarga_diaria';
  execute 'create policy solo_equipo on app_descarga_diaria for select to authenticated using (es_equipo_wip())';
  execute 'revoke all on app_descarga_diaria from anon';
end $$;

-- Cualquier periodo con el selector de Marketing; compara con el periodo anterior de la misma duración, o con p_comparar.
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
