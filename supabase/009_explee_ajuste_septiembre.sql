-- Ajuste de Explee (2026-10-05): lo que Explee tiene en su total acumulado y el registro diario no alcanzó a guardar
-- (envíos de fines de septiembre que el método anterior de "hoy" perdió). Se carga el 2026-09-29, por campaña,
-- como la diferencia entre el primer total acumulado (5 de octubre) y lo ya registrado hasta esa fecha.
insert into explee_campana_diario (fecha, campana_id, campana, enviados, respuestas, leads, gasto_usd)
select '2026-09-29', a.campana_id, a.campana,
       greatest(a.enviados - coalesce(r.enviados, 0), 0), greatest(a.respuestas - coalesce(r.respuestas, 0), 0),
       greatest(a.leads - coalesce(r.leads, 0), 0), greatest(a.gasto_usd - coalesce(r.gasto_usd, 0), 0)
  from (select distinct on (campana_id) * from explee_acumulado where fecha = '2026-10-05' order by campana_id, momento) a
  left join (select campana_id, sum(enviados) enviados, sum(respuestas) respuestas, sum(leads) leads, sum(gasto_usd) gasto_usd
               from explee_campana_diario where fecha <= '2026-10-05' group by campana_id) r using (campana_id)
 where a.enviados > coalesce(r.enviados, 0) or a.respuestas > coalesce(r.respuestas, 0)
    or a.leads > coalesce(r.leads, 0) or a.gasto_usd > coalesce(r.gasto_usd, 0)
on conflict (fecha, campana_id) do nothing;
