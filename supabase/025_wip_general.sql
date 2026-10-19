-- WIP General (2026-10-19): indicadores de la empresa, antes de las áreas (Marketing, Operaciones).
-- Hero metric: servicios registrados en la plataforma por mes (cobramos por servicio). Crecimiento (MoM, CMGR, crecimiento
-- anual, CAGR), clientes activos, churn de clientes, retención por cohorte, retención neta y bruta de servicios (equivalen al
-- NRR/GRR porque el precio va por servicio), quick ratio, concentración, conversión por etapa (Kommo) y CAC.
-- Los indicadores de ingresos (MRR, ARPA, LTV, payback, NRR de ingresos) salen de la tabla facturacion, que se llena
-- desde el tablero (un valor por cliente y mes); mientras esté vacía, la página los muestra como pendientes.
--
-- Cliente activo en un mes: al menos p_minimo servicios (20 por defecto). Las cuentas con "prueba", "demo", "test",
-- "qa" o "sandbox" en el nombre no cuentan como clientes (sus servicios sí suman a la hero metric).

create table if not exists facturacion (
  id              bigint generated always as identity primary key,
  mes             date not null,                -- primer día del mes facturado
  cliente         text not null,                -- igual al nombre de la compañía en la plataforma (owner.name)
  valor           numeric not null check (valor >= 0),
  moneda          text not null default 'COP' check (moneda in ('COP', 'USD')),
  nota            text not null default '',
  actualizado_por text not null default '',
  actualizado     timestamptz not null default now(),
  unique (mes, cliente)
);
alter table facturacion enable row level security;
drop policy if exists equipo_edita on facturacion;
create policy equipo_edita on facturacion for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip());
revoke all on facturacion from anon;

create or replace function es_cuenta_prueba(p_cliente text) returns boolean
language sql immutable as $$ select coalesce(p_cliente, '') = '' or p_cliente ~* '(prueba|demo|test|\mqa\M|sandbox)' $$;

create or replace function tablero_general(p_minimo int default 20, p_margen numeric default 0.8) returns jsonb
language plpgsql stable as $$
declare
  hoy    date := (now() at time zone 'America/Bogota')::date;
  actual date := date_trunc('month', hoy)::date;
  ult    date := (date_trunc('month', hoy) - interval '1 month')::date;   -- último mes completo
  minimo int  := greatest(1, coalesce(p_minimo, 20));
  margen numeric := least(1, greatest(0, coalesce(p_margen, 0.8)));
  dias_mes int := extract(day from (actual + interval '1 month - 1 day'))::int;
  inicio date := (select date_trunc('month', min(fecha))::date from plataforma_servicio_diario);
  r jsonb;
begin
  perform exigir_equipo();

  with
  -- Servicios por mes (todas las cuentas) y por cliente y mes (sin cuentas de prueba).
  total_mes as (
    select date_trunc('month', fecha)::date mes, sum(servicios)::numeric s from plataforma_servicio_diario group by 1
  ),
  cm as (
    select cliente, date_trunc('month', fecha)::date mes, sum(servicios)::numeric s
    from plataforma_servicio_diario where not es_cuenta_prueba(cliente) group by 1, 2
  ),
  meses as (select generate_series(inicio, actual, interval '1 month')::date mes),
  activos as (select cliente, mes, s from cm where s >= minimo),
  primero as (select cliente, min(mes) mes from activos group by 1),
  -- Cada mes activo de cada cliente, con si estuvo activo el mes anterior y el siguiente (uniones, no subconsultas por mes:
  -- con estas últimas la función pasaba del límite de tiempo de la API).
  marcas as (
    select a.cliente, a.mes, p.mes primer_mes, (ant.cliente is not null) antes, (sig.cliente is not null) despues
    from activos a
    join primero p on p.cliente = a.cliente
    left join activos ant on ant.cliente = a.cliente and ant.mes = (a.mes - interval '1 month')::date
    left join activos sig on sig.cliente = a.cliente and sig.mes = (a.mes + interval '1 month')::date
  ),
  por_mes as (
    select mes, count(*) activos, count(*) filter (where mes = primer_mes) nuevos,
           count(*) filter (where mes > primer_mes and not antes) reactivados
    from marcas group by 1
  ),
  bajas as (
    select (mes + interval '1 month')::date mes, count(*) perdidos from marcas where not despues group by 1
  ),
  serie as (
    select m.mes, coalesce(t.s, 0) servicios, coalesce(x.activos, 0) activos, coalesce(x.nuevos, 0) nuevos,
           coalesce(b.perdidos, 0) perdidos, coalesce(x.reactivados, 0) reactivados
    from meses m
    left join total_mes t on t.mes = m.mes
    left join por_mes x on x.mes = m.mes
    left join bajas b on b.mes = m.mes
  ),
  sm as (select mes, servicios s from serie),
  -- Servicios de un mes completo cualquiera.
  ttm as (
    select (select sum(s) from sm where mes between (ult - interval '11 month')::date and ult) t_actual,
           (select sum(s) from sm where mes between (ult - interval '23 month')::date and (ult - interval '12 month')::date) t_anterior,
           (select sum(s) from sm where mes between inicio and (inicio + interval '11 month')::date) t_primero
  ),
  -- Retención neta y bruta de servicios a 12 meses (ventanas de 3 meses para quitar ruido).
  base as (
    select cliente, sum(s) s0 from cm
    where mes between (ult - interval '14 month')::date and (ult - interval '12 month')::date group by 1 having sum(s) >= minimo * 3
  ),
  ahora as (
    select cliente, sum(s) s1 from cm where mes between (ult - interval '2 month')::date and ult group by 1
  ),
  nrr as (
    select sum(b.s0) s0, sum(coalesce(a.s1, 0)) s1, sum(least(coalesce(a.s1, 0), b.s0)) s1_tope, count(*) clientes,
           count(*) filter (where coalesce(a.s1, 0) >= minimo * 3) siguen
    from base b left join ahora a on a.cliente = b.cliente
  ),
  -- Quick ratio de servicios: variación mes a mes por cliente en los últimos 3 meses completos.
  cambios as (
    select m.mes, c.cliente, coalesce(x.s, 0) s, coalesce(y.s, 0) s_ant
    from (select generate_series((ult - interval '2 month')::date, ult, interval '1 month')::date mes) m
    cross join (select distinct cliente from cm where mes >= (ult - interval '3 month')::date) c
    left join cm x on x.cliente = c.cliente and x.mes = m.mes
    left join cm y on y.cliente = c.cliente and y.mes = (m.mes - interval '1 month')::date
  ),
  qr as (
    select sum(s) filter (where s_ant = 0 and s > 0) nuevos,
           sum(s - s_ant) filter (where s_ant > 0 and s > s_ant) expansion,
           sum(s_ant - s) filter (where s > 0 and s < s_ant) contraccion,
           sum(s_ant) filter (where s = 0 and s_ant > 0) perdida
    from cambios
  ),
  -- Concentración en los últimos 3 meses completos.
  conc as (
    select cliente, sum(s) s, row_number() over (order by sum(s) desc) pos
    from cm where mes between (ult - interval '2 month')::date and ult group by 1
  ),
  -- Cohortes por trimestre del primer mes activo.
  coh as (
    select p.cliente, date_trunc('quarter', p.mes)::date trimestre, p.mes m0 from primero p
  ),
  -- % de los clientes de la cohorte que siguen activos k meses después de su primer mes (solo meses ya cerrados).
  coh_k as (
    select c.trimestre, kk.k, round(100.0 * count(a.cliente) / count(*)) pct
    from coh c
    cross join (values (1), (3), (6), (12), (24)) kk(k)
    left join activos a on a.cliente = c.cliente and a.mes = (c.m0 + make_interval(months => kk.k))::date
    where (c.m0 + make_interval(months => kk.k))::date <= ult
    group by 1, 2
  ),
  cohortes as (
    select c.trimestre, count(*) clientes,
           (select jsonb_object_agg(z.k, z.pct) from coh_k z where z.trimestre = c.trimestre) retencion
    from coh c
    group by c.trimestre
  ),
  -- Embudo de Kommo: hasta qué etapa llegó cada oportunidad (llegar a una etapa posterior cuenta como haber pasado por las anteriores).
  llegadas as (
    select c.lead_id, max(e.orden) orden, min(c.momento) filter (where e.orden >= 70) cliente
    from kommo_cambio_etapa c join kommo_etapa e on e.etapa_id = c.a_etapa
    where e.tipo in ('abierta', 'ganada') group by 1
  ),
  leads as (
    select l.lead_id, (l.creado at time zone 'America/Bogota')::date creado,
           greatest(coalesce(x.orden, 0), case when e.tipo in ('abierta', 'ganada', 'entrantes') then e.orden else 0 end) orden,
           coalesce(x.cliente, case when e.orden >= 70 and e.tipo in ('abierta', 'ganada') then l.actualizado end) cliente
    from kommo_lead l left join kommo_etapa e on e.etapa_id = l.etapa_id left join llegadas x on x.lead_id = l.lead_id
  ),
  -- Facturación (ingresos) en pesos.
  fac as (select mes, cliente, a_pesos(valor, moneda, mes) cop from facturacion),
  fac_base as (select cliente, sum(cop) v0 from fac where mes between (ult - interval '14 month')::date and (ult - interval '12 month')::date group by 1),
  fac_ahora as (select cliente, sum(cop) v1 from fac where mes between (ult - interval '2 month')::date and ult group by 1)
  select jsonb_build_object(
    'hoy', hoy, 'mes_actual', actual, 'ultimo_mes', ult, 'inicio', inicio, 'minimo', minimo, 'margen', margen,
    'ultimo_dia', (select max(fecha) from plataforma_servicio_diario),
    -- Clientes de los últimos 12 meses (para el formulario de facturación: el nombre debe coincidir con la plataforma).
    'lista_clientes', (select coalesce(jsonb_agg(cliente order by s desc), '[]'::jsonb)
                       from (select cliente, sum(s) s from cm where mes >= (ult - interval '11 month')::date group by 1 having sum(s) >= minimo) x),
    'facturacion', (select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'mes', f.mes, 'cliente', f.cliente, 'valor', f.valor, 'moneda', f.moneda,
                                                                 'nota', f.nota) order by f.mes desc, f.valor desc), '[]'::jsonb)
                    from facturacion f where f.mes >= (ult - interval '5 month')::date),
    'serie', (select jsonb_agg(jsonb_build_object('mes', mes, 'servicios', servicios, 'activos', activos, 'nuevos', nuevos,
                                                  'perdidos', perdidos, 'reactivados', reactivados) order by mes) from serie),
    'hero', jsonb_build_object(
      'ultimo', (select s from sm where mes = ult),
      'anterior', (select s from sm where mes = (ult - interval '1 month')::date),
      'hace_un_ano', (select s from sm where mes = (ult - interval '12 month')::date),
      'actual', (select s from sm where mes = actual),
      -- Proyección del mes en curso al ritmo de los días ya cargados (la carga de Atlas trae hasta ayer).
      'proyeccion', round((select s from sm where mes = actual) * dias_mes
                          / greatest((select max(fecha) from plataforma_servicio_diario) - actual + 1, 1)),
      'record', (select max(s) from sm where mes <= ult),
      'record_mes', (select mes from sm where mes <= ult order by s desc limit 1)
    ),
    'crecimiento', jsonb_build_object(
      'mom', (select s from sm where mes = ult) / nullif((select s from sm where mes = (ult - interval '1 month')::date), 0) - 1,
      'cmgr3', power((select s from sm where mes = ult) / nullif((select s from sm where mes = (ult - interval '3 month')::date), 0), 1.0 / 3) - 1,
      'cmgr6', power((select s from sm where mes = ult) / nullif((select s from sm where mes = (ult - interval '6 month')::date), 0), 1.0 / 6) - 1,
      'cmgr12', power((select s from sm where mes = ult) / nullif((select s from sm where mes = (ult - interval '12 month')::date), 0), 1.0 / 12) - 1,
      'ttm', (select t_actual from ttm), 'ttm_anterior', (select t_anterior from ttm),
      'anual', (select t_actual / nullif(t_anterior, 0) - 1 from ttm),
      -- CAGR entre los primeros 12 meses de la plataforma y los últimos 12.
      'cagr', (select power(t_actual / nullif(t_primero, 0), 12.0 / nullif((date_part('year', ult) - date_part('year', inicio + interval '11 month')) * 12
                                                                      + date_part('month', ult) - date_part('month', inicio + interval '11 month'), 0)) - 1 from ttm),
      'cagr_desde', (inicio + interval '11 month')::date
    ),
    'clientes', jsonb_build_object(
      'activos', (select activos from serie where mes = ult),
      'activos_ant', (select activos from serie where mes = (ult - interval '1 month')::date),
      'activos_hace_un_ano', (select activos from serie where mes = (ult - interval '12 month')::date),
      'nuevos_3m', (select sum(nuevos) from serie where mes between (ult - interval '2 month')::date and ult),
      'perdidos_3m', (select sum(perdidos) from serie where mes between (ult - interval '2 month')::date and ult),
      'churn_ultimo', (select perdidos::numeric from serie where mes = ult) / nullif((select activos from serie where mes = (ult - interval '1 month')::date), 0),
      'churn_3m', (select sum(perdidos)::numeric from serie where mes between (ult - interval '2 month')::date and ult)
                  / nullif((select sum(activos) from serie where mes between (ult - interval '3 month')::date and (ult - interval '1 month')::date), 0),
      'churn_12m', (select sum(perdidos)::numeric from serie where mes between (ult - interval '11 month')::date and ult)
                  / nullif((select sum(activos) from serie where mes between (ult - interval '12 month')::date and (ult - interval '1 month')::date), 0)
    ),
    'retencion', (select jsonb_build_object('nrr', s1 / nullif(s0, 0), 'grr', s1_tope / nullif(s0, 0), 'clientes', clientes, 'siguen', siguen,
                                            'logos', siguen::numeric / nullif(clientes, 0)) from nrr),
    'quick_ratio', (select jsonb_build_object('nuevos', coalesce(nuevos, 0), 'expansion', coalesce(expansion, 0), 'contraccion', coalesce(contraccion, 0),
                                              'perdida', coalesce(perdida, 0),
                                              'ratio', (coalesce(nuevos, 0) + coalesce(expansion, 0)) / nullif(coalesce(contraccion, 0) + coalesce(perdida, 0), 0)) from qr),
    'concentracion', jsonb_build_object(
      'top1', (select s from conc where pos = 1) / nullif((select sum(s) from conc), 0),
      'top1_cliente', (select cliente from conc where pos = 1),
      'top5', (select sum(s) from conc where pos <= 5) / nullif((select sum(s) from conc), 0),
      'top', (select jsonb_agg(jsonb_build_object('cliente', cliente, 'servicios', s, 'pct', s / nullif((select sum(s) from conc), 0)) order by pos) from conc where pos <= 10)
    ),
    'cohortes', (select coalesce(jsonb_agg(jsonb_build_object('trimestre', trimestre, 'clientes', clientes, 'retencion', coalesce(retencion, '{}'::jsonb)) order by trimestre desc), '[]'::jsonb) from cohortes),
    'embudo', jsonb_build_object(
      'desde', greatest((hoy - 90), (select min(creado) from leads)),
      'etapas', (select jsonb_agg(jsonb_build_object('etapa', x.etapa, 'oportunidades', x.n) order by x.o) from (
          select v.o, v.etapa, (select count(*) from leads where creado >= hoy - 90 and orden >= v.o) n
          from (values (10, 'Leads nuevos'), (20, 'En conversación'), (40, 'Reunión agendada'), (50, 'Reunión hecha'),
                       (60, 'Propuesta enviada'), (70, 'Decidió tomar WIP')) v(o, etapa)) x)
    ),
    'cac', jsonb_build_object(
      'inversion_90', (select round(coalesce(sum(cop), 0)) from inversion_diaria(hoy - 90, hoy)),
      'clientes_90', (select count(*) from leads where (cliente at time zone 'America/Bogota')::date >= hoy - 90),
      'reuniones_90', (select count(*) from leads where creado >= hoy - 90 and orden >= 50),
      'nuevos_plataforma_90', (select count(*) from primero where mes >= (actual - interval '3 month')::date)
    ),
    'ingresos', jsonb_build_object(
      'meses_cargados', (select count(distinct mes) from facturacion),
      'mrr', (select round(sum(cop)) from fac where mes = ult),
      'mrr_ant', (select round(sum(cop)) from fac where mes = (ult - interval '1 month')::date),
      'clientes_facturados', (select count(distinct cliente) from fac where mes = ult and cop > 0),
      'nrr', (select sum(coalesce(a.v1, 0)) / nullif(sum(b.v0), 0) from fac_base b left join fac_ahora a on a.cliente = b.cliente),
      'serie', (select coalesce(jsonb_agg(jsonb_build_object('mes', mes, 'mrr', round(v)) order by mes), '[]'::jsonb) from (select mes, sum(cop) v from fac group by 1) x)
    )
  ) into r;
  return r;
end $$;
-- Corre con los permisos del dueño: las reglas de acceso fila por fila la hacían pasar de 8 s (el límite de la API) con
-- la sesión del equipo. Sigue exigiendo una cuenta @wiptool.com al empezar (exigir_equipo).
alter function tablero_general(int, numeric) security definer set search_path = public;
revoke all on function tablero_general(int, numeric) from anon;
