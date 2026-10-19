-- Costos de marketing (2026-10-19): la página /costos pasa de "costos fijos" a todo lo que cuesta el marketing,
-- con licencias, consumo (Claude, WhatsApp, Explee), pauta y pagos, y un total del mes.
--  - costos_fijos gana categoría, para qué sirve, tipo de cobro, estado, fechas de pago y método de pago. Solo las
--    suscripciones con suma_inversion (y cobro mensual o anual) siguen repartiéndose por día en la inversión.
--  - gastos: consumos o cargos puntuales (Claude API, WhatsApp Business, recargas). Suman a la inversión el día que
--    se registran, si suma_inversion.
--  - pagos: cobros de la tarjeta (Meta Ads y demás) con su estado. Solo se muestran: el gasto ya lo cuenta la
--    plataforma (Meta se mide por inversión diaria), así que no suman otra vez.
-- Los datos iniciales son los que se revisaron el 19 de octubre en cada plataforma y en los recibos del correo.

alter table costos_fijos add column if not exists categoria text not null default 'Herramientas de marketing';
alter table costos_fijos add column if not exists para_que text not null default '';
alter table costos_fijos add column if not exists cobro text not null default 'mensual';
alter table costos_fijos add column if not exists estado text not null default 'activo';
alter table costos_fijos add column if not exists proximo_pago date;
alter table costos_fijos add column if not exists ultimo_pago date;
alter table costos_fijos add column if not exists ultimo_pago_monto numeric;
alter table costos_fijos add column if not exists ultimo_pago_estado text not null default '';
alter table costos_fijos add column if not exists metodo_pago text not null default '';
alter table costos_fijos add column if not exists suma_inversion boolean not null default true;

alter table costos_fijos drop constraint if exists costos_fijos_cobro_check;
alter table costos_fijos add constraint costos_fijos_cobro_check check (cobro in ('mensual', 'anual', 'prepago', 'consumo', 'gratis'));
alter table costos_fijos drop constraint if exists costos_fijos_estado_check;
alter table costos_fijos add constraint costos_fijos_estado_check check (estado in ('activo', 'prueba', 'suspendido', 'por_confirmar'));

create table if not exists gastos (
  id              bigint generated always as identity primary key,
  plataforma      text not null,
  fecha           date not null,
  monto           numeric not null check (monto >= 0),
  moneda          text not null default 'COP' check (moneda in ('COP', 'USD')),
  concepto        text not null default '',
  suma_inversion  boolean not null default true,
  actualizado_por text not null default '',
  actualizado     timestamptz not null default now()
);

create table if not exists pagos (
  id              bigint generated always as identity primary key,
  plataforma      text not null,
  fecha           date not null,
  monto           numeric not null check (monto >= 0),
  moneda          text not null default 'COP' check (moneda in ('COP', 'USD')),
  estado          text not null default 'pagado' check (estado in ('pagado', 'pendiente', 'fallido')),
  referencia      text not null default '',
  nota            text not null default '',
  actualizado_por text not null default '',
  actualizado     timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['gastos', 'pagos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists equipo_edita on %I', t);
    execute format('create policy equipo_edita on %I for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Inversión diaria: las suscripciones solo si suman (Kommo en prueba, Calendly gratis… no), y los gastos puntuales.
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
   where c.suma_inversion and c.cobro in ('mensual', 'anual')
  union all
  select x.fecha, x.plataforma, a_pesos(x.monto, x.moneda, x.fecha)
    from gastos x where x.suma_inversion and x.fecha between p_desde and p_hasta
$$;

-- ---------------------------------------------------------------------------
-- Página Costos de marketing: un mes (p_mes = cualquier día del mes).
-- ---------------------------------------------------------------------------
create or replace function tablero_costos(p_mes date) returns jsonb
language plpgsql stable as $$
declare
  ini date := date_trunc('month', p_mes)::date;
  fin date := (date_trunc('month', p_mes) + interval '1 month - 1 day')::date;
  corte date := least(fin, (now() at time zone 'America/Bogota')::date);
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'mes', ini,
    'corte', corte,
    'trm', trm_en(corte),
    'suscripciones', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'plataforma', c.plataforma, 'categoria', c.categoria, 'para_que', c.para_que, 'nota', c.nota,
        'monto', c.monto, 'moneda', c.moneda, 'cobro', c.cobro, 'estado', c.estado, 'desde', c.desde, 'hasta', c.hasta,
        'proximo_pago', c.proximo_pago, 'ultimo_pago', c.ultimo_pago, 'ultimo_pago_monto', c.ultimo_pago_monto,
        'ultimo_pago_estado', c.ultimo_pago_estado, 'metodo_pago', c.metodo_pago, 'suma_inversion', c.suma_inversion,
        'actualizado_por', c.actualizado_por, 'actualizado', c.actualizado,
        -- Lo que suma en el mes (repartido por día, igual que la inversión).
        'cop_mes', (select coalesce(round(sum(cop)), 0) from inversion_diaria(ini, corte) i where i.plataforma = c.plataforma),
        -- Lo que lleva gastado en el mes por consumo, sume o no a la inversión de marketing (gastos registrados y Explee).
        'gasto_mes', (select coalesce(round(sum(a_pesos(x.monto, x.moneda, x.fecha))), 0) from gastos x
                       where x.plataforma = c.plataforma and x.fecha between ini and fin)
                     + case when c.plataforma = 'Explee' then (select coalesce(round(sum(a_pesos(e.gasto_usd, 'USD', e.fecha))), 0)
                                                                 from explee_campana_diario e where e.fecha between ini and fin) else 0 end
      ) order by c.categoria, c.plataforma), '[]'::jsonb)
      from costos_fijos c where c.desde <= fin and (c.hasta is null or c.hasta >= ini - 62)),
    'gastos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.id, 'plataforma', x.plataforma, 'fecha', x.fecha, 'monto', x.monto, 'moneda', x.moneda, 'concepto', x.concepto,
        'suma_inversion', x.suma_inversion, 'cop', round(a_pesos(x.monto, x.moneda, x.fecha))
      ) order by x.fecha desc, x.plataforma), '[]'::jsonb)
      from gastos x where x.fecha between ini and fin),
    'explee', jsonb_build_object(
      'usd', (select coalesce(round(sum(e.gasto_usd), 2), 0) from explee_campana_diario e where e.fecha between ini and fin),
      'cop', (select coalesce(round(sum(a_pesos(e.gasto_usd, 'USD', e.fecha))), 0) from explee_campana_diario e where e.fecha between ini and fin),
      'enviados', (select coalesce(sum(e.enviados), 0) from explee_campana_diario e where e.fecha between ini and fin)),
    'pauta', jsonb_build_object(
      'meta', (select coalesce(round(sum(a_pesos(m.inversion, m.moneda, m.fecha))), 0) from meta_campana_diario m where m.fecha between ini and fin),
      'gads', (select coalesce(round(sum(a_pesos(g.inversion, g.moneda, g.fecha))), 0) from gads_campana_diario g where g.fecha between ini and fin)),
    'pagos', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'plataforma', p.plataforma, 'fecha', p.fecha, 'monto', p.monto, 'moneda', p.moneda, 'estado', p.estado,
        'referencia', p.referencia, 'nota', p.nota, 'cop', round(a_pesos(p.monto, p.moneda, p.fecha))
      ) order by p.fecha desc, p.plataforma), '[]'::jsonb)
      from pagos p where p.fecha between ini and fin or (p.estado = 'pendiente' and p.fecha <= fin)),
    'por_plataforma', (select coalesce(jsonb_agg(jsonb_build_object('plataforma', plataforma, 'cop', cop) order by cop desc), '[]'::jsonb)
      from (select plataforma, round(sum(cop)) cop from inversion_diaria(ini, corte) group by 1) x),
    'total', (select coalesce(round(sum(cop)), 0) from inversion_diaria(ini, corte)),
    -- Gastos que no son de marketing (WhatsApp de la plataforma): se muestran aparte y no suman a la inversión.
    'fuera_marketing', (select coalesce(round(sum(a_pesos(x.monto, x.moneda, x.fecha))), 0) from gastos x
                         where not x.suma_inversion and x.fecha between ini and fin)
  );
end $$;
revoke all on function tablero_costos(date) from anon;

-- ---------------------------------------------------------------------------
-- Datos revisados el 19 de octubre de 2026.
-- ---------------------------------------------------------------------------
update costos_fijos set categoria = 'Herramientas de marketing', para_que = 'Correos de nutrición y secuencias (Info solicitada, Nutrición WIP equipos)',
  cobro = 'mensual', estado = 'activo', proximo_pago = '2026-11-07', ultimo_pago = '2026-10-07', ultimo_pago_monto = 17,
  ultimo_pago_estado = 'pagado', metodo_pago = 'Tarjeta registrada en Brevo', nota = 'Plan Starter · 10.000 correos al mes (quedan 8.973)',
  actualizado_por = 'revisión 19 oct', actualizado = now()
where plataforma = 'Brevo';

insert into costos_fijos (plataforma, monto, moneda, desde, hasta, nota, categoria, para_que, cobro, estado, proximo_pago,
                          ultimo_pago, ultimo_pago_monto, ultimo_pago_estado, metodo_pago, suma_inversion, actualizado_por)
select v.*, 'revisión 19 oct' from (values
  ('n8n', 27::numeric, 'USD', '2026-10-13'::date, null::date,
   'Plan Starter. €24 al mes es el precio de lista: confirmar el valor y la fecha en el portal de facturación de n8n (el recibo no llega a jessica@).',
   'Automatización e IA', 'Flujos F12 a F20: Meli, carga del tablero, recordatorios, retomes', 'mensual', 'por_confirmar',
   null::date, null::date, null::numeric, '', 'Por confirmar', true),
  ('Kommo', 45, 'USD', '2026-10-20', null,
   'Prueba de Pro que vence el 20 de octubre. Precio por usuario al mes: Básico US$20, Avanzado US$30, Pro US$45 (con pago anual US$16,67 / 25 / 37,50). El 13 y 14 de octubre la API respondió "Payment required" y Meli dejó de mover leads.',
   'CRM y WhatsApp', 'CRM, WhatsApp comercial y Salesbots de plantillas (1 usuario)', 'mensual', 'prueba',
   '2026-10-20', null, null, '', 'Sin pagar aún', false),
  ('Calendly', 0, 'USD', '2026-09-01', null,
   'Plan gratis: no permite cambiar el asunto del correo de confirmación.', 'Herramientas de marketing',
   'Agenda de demos (cuenta comercial@, Meli de Wip)', 'gratis', 'activo', null, null, null, '', '', false),
  ('Canva Pro', 3500, 'COP', '2026-07-09', null,
   'Solo aparece la factura del 9 de julio (COP 3.500, precio de promoción del primer mes). Confirmar si sigue activa y cuánto cobra ahora.',
   'Herramientas de marketing', 'Piezas de diseño y anuncios', 'mensual', 'por_confirmar',
   null, '2026-07-09', 3500, 'pagado', 'Mastercard •••• 7442', true),
  ('Apollo.io', 59, 'USD', '2026-07-03', '2026-09-03',
   'Pagos fallidos el 4 y el 18 de septiembre; el servicio quedó suspendido el 2 de octubre. Decidir si se cancela o se paga la deuda.',
   'Prospección', 'Base de datos de contactos B2B', 'mensual', 'suspendido',
   null, '2026-08-04', 59, 'pagado', 'Tarjeta registrada en Apollo', true),
  ('Claude Pro', 20, 'USD', '2026-10-16', null,
   'Suscripción del chat de Claude (no es la API de Meli). El cobro falló dos veces el 16 de octubre y luego pasó.',
   'Automatización e IA', 'Asistente de trabajo (claude.ai)', 'mensual', 'activo',
   '2026-11-16', '2026-10-16', 20, 'pagado', 'Visa •••• 6020', true),
  ('Claude API (Meli)', 0, 'USD', '2026-09-01', null,
   'Créditos prepagados. Saldo US$8,83 el 19 de octubre y la recarga automática está apagada: cuando se acaban, Meli y el calificador dejan de responder sin avisar.',
   'Automatización e IA', 'Meli (WhatsApp), calificador y seguimientos', 'prepago', 'activo',
   null, '2026-10-09', 20, 'pagado', 'Visa •••• 6020', false),
  ('Explee', 0, 'USD', '2026-09-01', null,
   'Prepago por correo enviado (US$0,03; sube a US$0,04 desde el 23 de octubre). El saldo se agotó el 8 y el 18 de octubre y las campañas quedaron en pausa. El gasto diario ya lo trae el tablero desde Explee.',
   'Prospección', 'Correos de prospección en frío', 'prepago', 'activo',
   null, null, null, '', 'Tarjeta registrada en Explee', false),
  ('WhatsApp Business (comercial)', 0, 'USD', '2026-10-19', null,
   'Número +57 300 5124111, cuenta "wip" de Meta. Las plantillas de Marketing se cobran solo fuera de la ventana gratis de 72 h de los anuncios. Sin método de pago hasta el 19 de octubre (152 retomes fallidos en octubre).',
   'CRM y WhatsApp', 'Plantillas de retome, recordatorios y demo no realizada', 'consumo', 'activo',
   null, null, null, '', 'Mastercard •••• 5177', false),
  ('WhatsApp Business (plataforma)', 0, 'USD', '2026-07-01', null,
   'Número +57 301 8245834, cuenta "Wip" de Meta: notificaciones de la plataforma WIP a los clientes finales (sobre todo la plantilla de calificación, que es de Marketing). Unos US$82,73 en 90 días.',
   'Operación de la plataforma', 'Mensajes de la "app sin app" a los clientes de los clientes', 'consumo', 'activo',
   null, '2026-10-05', 4.39, 'pagado', 'Mastercard •••• 5177', false)
) v(plataforma, monto, moneda, desde, hasta, nota, categoria, para_que, cobro, estado, proximo_pago,
    ultimo_pago, ultimo_pago_monto, ultimo_pago_estado, metodo_pago, suma_inversion)
where not exists (select 1 from costos_fijos c where c.plataforma = v.plataforma);

insert into gastos (plataforma, fecha, monto, moneda, concepto, suma_inversion, actualizado_por)
select * from (values
  ('Claude API (Meli)', '2026-10-19'::date, 16.17::numeric, 'USD', 'Consumo del 1 al 19 de octubre (consola de Claude)', true, 'revisión 19 oct'),
  ('WhatsApp Business (plataforma)', '2026-10-19', 14.87, 'USD', 'Saldo de octubre por cobrar (Meta lo carga a la tarjeta)', false, 'revisión 19 oct'),
  ('WhatsApp Business (comercial)', '2026-10-19', 0, 'USD', 'Octubre: todos los mensajes entraron gratis (ventana de 72 h de los anuncios)', true, 'revisión 19 oct')
) v(plataforma, fecha, monto, moneda, concepto, suma_inversion, actualizado_por)
where not exists (select 1 from gastos g where g.plataforma = v.plataforma and g.fecha = v.fecha);

insert into pagos (plataforma, fecha, monto, moneda, estado, referencia, nota, actualizado_por)
select * from (values
  ('Meta Ads', '2026-08-19'::date, 437905::numeric, 'COP', 'fallido', 'APZ6AYRGA2', 'Visa •••• 6041', 'revisión 19 oct'),
  ('Meta Ads', '2026-08-19', 437905, 'COP', 'pagado', 'X3CQ6YMGA2', 'Visa •••• 6041', 'revisión 19 oct'),
  ('Meta Ads', '2026-08-31', 384174, 'COP', 'pagado', '2TWJSZHGA2', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-09-14', 500000, 'COP', 'pagado', 'WQLWZ36HA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-09-18', 203428, 'COP', 'pagado', '5XGJK46HA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-09-24', 455038, 'COP', 'pagado', 'ZRHSV5SGA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-09-30', 74874, 'COP', 'pagado', 'L4QBQ5EGA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-10-03', 455038, 'COP', 'pagado', '4YTK76NGA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-10-08', 455038, 'COP', 'pagado', 'VDZVU6NGA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-10-15', 455038, 'COP', 'pagado', 'W3X4B86HA4', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Meta Ads', '2026-10-19', 215208, 'COP', 'pendiente', 'Saldo pendiente', 'La cuenta llegó a su límite de gasto y los anuncios están detenidos', 'revisión 19 oct'),
  ('Brevo', '2026-07-02', 17, 'USD', 'pagado', 'SIB-5401219', '', 'revisión 19 oct'),
  ('Brevo', '2026-08-02', 17, 'USD', 'pagado', 'SIB-5587551', '', 'revisión 19 oct'),
  ('Brevo', '2026-09-07', 17, 'USD', 'pagado', 'SIB-5809529', 'La del 2 de septiembre se canceló y se cobró el 7', 'revisión 19 oct'),
  ('Brevo', '2026-10-07', 17, 'USD', 'pagado', 'SIB-6014875', '', 'revisión 19 oct'),
  ('Claude Pro', '2026-10-16', 20, 'USD', 'pagado', '2984-0977-5007', 'Dos intentos fallidos antes, el mismo día', 'revisión 19 oct'),
  ('Claude API (Meli)', '2026-10-09', 20, 'USD', 'pagado', 'LBQHU7YE-0001', 'Compra de créditos', 'revisión 19 oct'),
  ('WhatsApp Business (plataforma)', '2026-10-05', 4.39, 'USD', 'pagado', '', 'Mastercard •••• 5177', 'revisión 19 oct'),
  ('Apollo.io', '2026-09-04', 59, 'USD', 'fallido', '', 'Tarjeta rechazada', 'revisión 19 oct'),
  ('Apollo.io', '2026-09-18', 59, 'USD', 'fallido', '', 'Tarjeta rechazada; servicio suspendido el 2 de octubre', 'revisión 19 oct')
) v(plataforma, fecha, monto, moneda, estado, referencia, nota, actualizado_por)
where not exists (select 1 from pagos p where p.plataforma = v.plataforma and p.fecha = v.fecha and p.referencia = v.referencia);
