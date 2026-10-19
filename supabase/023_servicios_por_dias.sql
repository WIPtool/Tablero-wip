-- Operaciones › Servicios, vista "Por días" (2026-10-15): cualquier periodo (7 días, una semana, fechas a elección…)
-- con el mismo selector de Marketing. Compara con el periodo anterior de la misma duración, o con p_comparar
-- ("Esta semana" se compara con los mismos días de la semana pasada).
create or replace function tablero_servicios_dias(p_desde date, p_hasta date, p_comparar date default null) returns jsonb
language plpgsql stable as $$
declare
  n       int  := p_hasta - p_desde + 1;
  a_desde date := coalesce(p_comparar, p_desde - n);
  a_hasta date := coalesce(p_comparar, p_desde - n) + n - 1;
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'ultimo_dia', (select max(fecha) from plataforma_servicio_diario),
    'kpis', (
      select jsonb_build_object(
        'servicios',       coalesce(sum(servicios) filter (where actual), 0),
        'servicios_ant',   coalesce(sum(servicios) filter (where not actual), 0),
        'finalizados',     coalesce(sum(servicios) filter (where actual and estado = 'Finalizado'), 0),
        'finalizados_ant', coalesce(sum(servicios) filter (where not actual and estado = 'Finalizado'), 0),
        'cancelados',      coalesce(sum(servicios) filter (where actual and estado = 'Cancelado'), 0),
        'cancelados_ant',  coalesce(sum(servicios) filter (where not actual and estado = 'Cancelado'), 0),
        'clientes',        count(distinct cliente) filter (where actual and servicios > 0),
        'clientes_ant',    count(distinct cliente) filter (where not actual and servicios > 0),
        'por_dia',         round(coalesce(sum(servicios) filter (where actual), 0)::numeric / n),
        'por_dia_ant',     round(coalesce(sum(servicios) filter (where not actual), 0)::numeric / n))
      from (select *, fecha between p_desde and p_hasta actual from plataforma_servicio_diario
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta) x
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', d.dia, 'servicios', coalesce(s.servicios, 0),
                                                   'finalizados', coalesce(s.finalizados, 0)) order by d.dia), '[]'::jsonb)
      from (select generate_series(p_desde, p_hasta, interval '1 day')::date dia) d
      left join (select fecha, sum(servicios) servicios, sum(servicios) filter (where estado = 'Finalizado') finalizados
                 from plataforma_servicio_diario where fecha between p_desde and p_hasta group by fecha) s on s.fecha = d.dia
    ),
    'por_cliente', (
      select coalesce(jsonb_agg(jsonb_build_object('cliente', cliente, 'servicios', servicios, 'servicios_ant', servicios_ant,
                                                   'finalizados', finalizados, 'cancelados', cancelados,
                                                   'tasa_finalizados', case when servicios > 0 then finalizados::numeric / servicios end)
                                order by servicios desc, servicios_ant desc), '[]'::jsonb)
      from (select coalesce(nullif(cliente, ''), 'Sin cliente') cliente,
                   coalesce(sum(servicios) filter (where fecha between p_desde and p_hasta), 0) servicios,
                   coalesce(sum(servicios) filter (where fecha between a_desde and a_hasta), 0) servicios_ant,
                   coalesce(sum(servicios) filter (where fecha between p_desde and p_hasta and estado = 'Finalizado'), 0) finalizados,
                   coalesce(sum(servicios) filter (where fecha between p_desde and p_hasta and estado = 'Cancelado'), 0) cancelados
            from plataforma_servicio_diario
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta group by 1) x
    ),
    'por_tipo', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'servicios', servicios, 'servicios_ant', servicios_ant)
                                order by servicios desc, servicios_ant desc), '[]'::jsonb)
      from (select coalesce(nullif(tipo, ''), 'Sin tipo') tipo,
                   coalesce(sum(servicios) filter (where fecha between p_desde and p_hasta), 0) servicios,
                   coalesce(sum(servicios) filter (where fecha between a_desde and a_hasta), 0) servicios_ant
            from plataforma_servicio_diario
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta group by 1) x
    ),
    'por_estado', (
      select coalesce(jsonb_agg(jsonb_build_object('estado', estado, 'servicios', servicios, 'servicios_ant', servicios_ant)
                                order by servicios desc, servicios_ant desc), '[]'::jsonb)
      from (select coalesce(nullif(estado, ''), 'Sin estado') estado,
                   coalesce(sum(servicios) filter (where fecha between p_desde and p_hasta), 0) servicios,
                   coalesce(sum(servicios) filter (where fecha between a_desde and a_hasta), 0) servicios_ant
            from plataforma_servicio_diario
            where fecha between p_desde and p_hasta or fecha between a_desde and a_hasta group by 1) x
    )
  );
end $$;
revoke all on function tablero_servicios_dias(date, date, date) from anon;
