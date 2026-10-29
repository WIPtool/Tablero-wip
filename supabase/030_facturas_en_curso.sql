-- Operaciones › Gastos (2026-10-29): las facturas en curso de Atlas (estado PENDING, monto 0 hasta que cierra el mes) no
-- se listan ni cuentan; y "facturas después del último pago" no cuenta las que ya están pagadas o no se cobran.

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
                                                   'moneda', moneda, 'archivo', archivo, 'correo_url', correo_url) order by fecha desc, numero desc), '[]'::jsonb)
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
