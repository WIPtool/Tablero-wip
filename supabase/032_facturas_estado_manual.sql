-- Operaciones › Gastos y Marketing › Inversión (2026-11-02): el equipo puede marcar a mano una factura como pagada o sin
-- pagar desde el tablero. Va en su propia columna para que las cargas automáticas (F21 a F26, Lambdas de AWS y Atlas) no la
-- pisen: el tablero usa estado_manual si tiene algo; si no, el estado del proveedor o el que deduce de los pagos.
alter table proveedor_factura add column if not exists estado_manual text not null default '';   -- '' | 'PAID' | 'SIN_PAGAR'
alter table proveedor_factura add column if not exists estado_manual_por text not null default '';
alter table proveedor_factura add column if not exists estado_manual_en timestamptz;

-- Marca (o quita, con '') el estado a mano. Solo el equipo; queda quién y cuándo.
create or replace function marcar_estado_factura(p_id text, p_estado text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform exigir_equipo();
  if p_estado not in ('', 'PAID', 'SIN_PAGAR') then raise exception 'Estado no válido: %', p_estado; end if;
  update proveedor_factura
     set estado_manual = p_estado,
         estado_manual_por = case when p_estado = '' then '' else coalesce(auth.jwt() ->> 'email', '') end,
         estado_manual_en = case when p_estado = '' then null else now() end
   where id = p_id;
  if not found then raise exception 'No existe la factura %', p_id; end if;
end $$;
revoke all on function marcar_estado_factura(text, text) from public, anon;
grant execute on function marcar_estado_factura(text, text) to authenticated;

create or replace function tablero_gastos(p_proveedor text) returns jsonb
language plpgsql stable as $$
declare
  ultimo_pago date := (select max(fecha) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago');
begin
  perform exigir_equipo();
  return jsonb_build_object(
    'kpis', jsonb_build_object(
      'facturas',           (select count(*) from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING'),
      'facturado_12m',      (select sum(monto) from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING' and fecha > current_date - 365),
      'promedio_12m',       (select round(avg(monto), 2) from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING' and fecha > current_date - 365),
      'ultima_factura',     (select max(fecha) from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING'),
      'ultima_factura_monto', (select monto from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING' order by fecha desc, numero desc limit 1),
      'ultima_factura_periodo', (select periodo from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING' order by fecha desc, numero desc limit 1),
      'penultima_factura_monto', (select monto from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING' order by fecha desc, numero desc offset 1 limit 1),
      'pagado_12m',         (select sum(monto) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago' and fecha > current_date - 365),
      'ultimo_pago',        ultimo_pago,
      'ultimo_pago_monto',  (select monto from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago' order by fecha desc limit 1),
      'rechazos_sin_pago',  (select count(*) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'rechazo'
                              and fecha > coalesce(ultimo_pago, '1900-01-01')),
      'ultimo_rechazo',     (select max(fecha) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'rechazo'),
      'facturas_sin_pago',  (select count(*) from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING' and fecha > coalesce(ultimo_pago, '1900-01-01')
                              and estado not in ('PAID', 'FREE', 'FORGIVEN', 'PREPAID'))
    ),
    'facturas', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cuenta', cuenta, 'numero', numero, 'fecha', fecha, 'periodo', periodo, 'estado', estado, 'monto', monto,
                                                   'moneda', moneda, 'archivo', archivo, 'archivo_csv', archivo_csv, 'correo_url', correo_url,
                                                   'estado_manual', estado_manual, 'estado_manual_por', estado_manual_por) order by fecha desc, numero desc), '[]'::jsonb)
      from proveedor_factura where proveedor = p_proveedor and estado <> 'PENDING'
    ),
    'movimientos', (
      select coalesce(jsonb_agg(jsonb_build_object('fecha', fecha, 'cuenta', cuenta, 'tipo', tipo, 'monto', monto, 'moneda', moneda,
                                                   'detalle', detalle, 'correo_url', correo_url) order by fecha desc), '[]'::jsonb)
      from proveedor_movimiento where proveedor = p_proveedor
    )
  );
end $$;
revoke all on function tablero_gastos(text) from anon;
