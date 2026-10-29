-- Operaciones › Gastos (2026-10-29): facturas, pagos y rechazos de los proveedores de la plataforma (Google Workspace
-- primero; después AWS y MongoDB Atlas). Las de Google Workspace las carga el flujo n8n F21 leyendo los correos de cobro
-- de Google (payments-noreply@google.com) en misha@wiptool.com: guarda el PDF de cada factura en el bucket privado
-- "facturas" y una fila por factura, pago recibido y pago rechazado. No confundir con gastos/pagos de 024 (costos de
-- marketing, que se llenan a mano).

create table if not exists proveedor_factura (
  id          text primary key,                  -- '<proveedor>:<número de factura>'
  proveedor   text not null,                     -- 'google-workspace' | 'aws' | 'mongodb'
  cuenta      text not null default '',          -- dominio o cuenta del proveedor
  numero      text not null,
  fecha       date not null,                     -- fecha de la factura (la del correo, hora de Colombia)
  monto       numeric,                           -- total de la factura, leído del PDF (null si no se pudo leer)
  moneda      text not null default 'USD',
  archivo     text not null default '',          -- ruta del PDF en el bucket "facturas"
  correo_url  text not null default '',
  actualizado timestamptz not null default now()
);
create index if not exists proveedor_factura_fecha on proveedor_factura (proveedor, fecha desc);

create table if not exists proveedor_movimiento (
  id          text primary key,                  -- id del correo
  proveedor   text not null,
  cuenta      text not null default '',
  fecha       date not null,
  tipo        text not null check (tipo in ('pago', 'rechazo')),
  monto       numeric,                           -- los rechazos no traen monto
  moneda      text not null default 'USD',
  detalle     text not null default '',          -- p. ej. la tarjeta rechazada (solo los últimos 4 dígitos)
  correo_url  text not null default '',
  actualizado timestamptz not null default now()
);
create index if not exists proveedor_movimiento_fecha on proveedor_movimiento (proveedor, fecha desc);

do $$
declare t text;
begin
  foreach t in array array['proveedor_factura', 'proveedor_movimiento'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists solo_equipo on %I', t);
    execute format('create policy solo_equipo on %I for select to authenticated using (es_equipo_wip())', t);
    execute format('revoke all on %I from anon', t);
  end loop;
end $$;

-- PDF de las facturas: bucket privado; lo lee solo el equipo (el tablero genera enlaces firmados de descarga) y lo
-- escribe solo n8n con la clave de servicio.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturas', 'facturas', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists facturas_equipo_lee on storage.objects;
create policy facturas_equipo_lee on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and public.es_equipo_wip());

-- n8n marca la carga en "cargas" (el punto verde de la barra lateral) al terminar.
create or replace function registrar_carga(p_fuente text, p_filas integer) returns void
language sql security definer set search_path = public as $$
  insert into cargas (fuente, actualizado, filas, estado, mensaje) values (p_fuente, now(), p_filas, 'ok', '')
  on conflict (fuente) do update set actualizado = excluded.actualizado, filas = excluded.filas, estado = 'ok', mensaje = '';
$$;
revoke all on function registrar_carga(text, integer) from public, anon, authenticated;

-- Página Operaciones › Gastos, una pestaña por proveedor.
create or replace function tablero_gastos(p_proveedor text) returns jsonb
language plpgsql stable as $$
declare
  ultimo_pago date := (select max(fecha) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago');
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'facturas',           (select count(*) from proveedor_factura where proveedor = p_proveedor),
      'facturado_12m',      (select sum(monto) from proveedor_factura where proveedor = p_proveedor and fecha > current_date - 365),
      'pagado_12m',         (select sum(monto) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago' and fecha > current_date - 365),
      'ultimo_pago',        ultimo_pago,
      'ultimo_pago_monto',  (select monto from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago' order by fecha desc limit 1),
      'rechazos_sin_pago',  (select count(*) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'rechazo'
                              and fecha > coalesce(ultimo_pago, '1900-01-01')),
      'ultimo_rechazo',     (select max(fecha) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'rechazo'),
      'facturas_sin_pago',  (select count(*) from proveedor_factura where proveedor = p_proveedor and fecha > coalesce(ultimo_pago, '1900-01-01'))
    ),
    'facturas', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cuenta', cuenta, 'numero', numero, 'fecha', fecha, 'monto', monto,
                                                   'moneda', moneda, 'archivo', archivo, 'correo_url', correo_url) order by fecha desc, numero desc), '[]'::jsonb)
      from proveedor_factura where proveedor = p_proveedor
    ),
    'movimientos', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'cuenta', cuenta, 'tipo', tipo, 'monto', monto, 'moneda', moneda,
                                                   'detalle', detalle, 'correo_url', correo_url) order by fecha desc), '[]'::jsonb)
      from proveedor_movimiento where proveedor = p_proveedor
    )
  );
end $$;
revoke all on function tablero_gastos(text) from anon;
