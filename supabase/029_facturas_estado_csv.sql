-- Operaciones › Gastos (2026-10-29): MongoDB Atlas. Atlas da el estado de cada factura (PAID, PENDING, FAILED, CLOSED…)
-- y el detalle en CSV (no da PDF por API): columna estado y el bucket "facturas" acepta también CSV.
alter table proveedor_factura add column if not exists estado text not null default '';
update storage.buckets set allowed_mime_types = array['application/pdf', 'text/csv'] where id = 'facturas';

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
      'promedio_12m',       (select round(avg(monto), 2) from proveedor_factura where proveedor = p_proveedor and fecha > current_date - 365),
      'ultima_factura',     (select max(fecha) from proveedor_factura where proveedor = p_proveedor),
      'ultima_factura_monto', (select monto from proveedor_factura where proveedor = p_proveedor order by fecha desc, numero desc limit 1),
      'ultima_factura_periodo', (select periodo from proveedor_factura where proveedor = p_proveedor order by fecha desc, numero desc limit 1),
      'penultima_factura_monto', (select monto from proveedor_factura where proveedor = p_proveedor order by fecha desc, numero desc offset 1 limit 1),
      'pagado_12m',         (select sum(monto) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago' and fecha > current_date - 365),
      'ultimo_pago',        ultimo_pago,
      'ultimo_pago_monto',  (select monto from proveedor_movimiento where proveedor = p_proveedor and tipo = 'pago' order by fecha desc limit 1),
      'rechazos_sin_pago',  (select count(*) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'rechazo'
                              and fecha > coalesce(ultimo_pago, '1900-01-01')),
      'ultimo_rechazo',     (select max(fecha) from proveedor_movimiento where proveedor = p_proveedor and tipo = 'rechazo'),
      'facturas_sin_pago',  (select count(*) from proveedor_factura where proveedor = p_proveedor and fecha > coalesce(ultimo_pago, '1900-01-01'))
    ),
    'facturas', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'cuenta', cuenta, 'numero', numero, 'fecha', fecha, 'periodo', periodo, 'estado', estado, 'monto', monto,
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
