import { clienteServidor } from '@/lib/supabase/servidor';
import { MODO_EJEMPLO } from '@/lib/config';
import { demo as demoJs } from '@/lib/demo';

const demo = demoJs as unknown as Record<string, (p: Record<string, unknown>) => unknown>;

// Respuestas de las funciones de Supabase (supabase/002_funciones.sql).
export interface Kpis { [clave: string]: number | null }
export interface Resumen {
  kpis: Kpis;
  serie: { fecha: string; visitas: number; conversiones: number }[];
  conversiones_por_tipo: { tipo: string; conversiones: number }[];
  canales: { canal: string; visitas: number; conversiones: number }[];
  clics_por_origen: { origen: string; clic_a: string; clics: number; personas: number }[];
  citas_por_origen: { origen: string; citas: number; personas: number }[];
  app_sin_app: { cliente: string; visitas: number; conversiones: number }[];
}
export interface Sitio {
  paginas: { pagina: string; visitas: number; conversiones: number }[];
  paises: { pais: string; visitas: number; conversiones: number }[];
  dispositivos: { dispositivo: string; visitas: number; conversiones: number }[];
}
export interface Seo {
  ultimo_dia: string | null;
  kpis: Kpis;
  serie: { fecha: string; clics: number; impresiones: number }[];
  consultas: { consulta: string; clics: number; impresiones: number; posicion: number }[];
  paginas: { pagina: string; clics: number; impresiones: number; posicion: number }[];
}
export interface Carga { fuente: string; actualizado: string; filas: number; estado: string; mensaje: string }

// Llama una función de Supabase con la sesión de la persona (o el modo de ejemplo en desarrollo).
export async function pedir<T>(funcion: string, params: Record<string, unknown> = {}): Promise<T> {
  if (MODO_EJEMPLO) return demo[funcion](params) as T;
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc(funcion, params);
  if (error) throw new Error(error.message);
  return data as T;
}

export interface Pauta {
  kpis: Kpis;
  serie: { fecha: string; inversion: number; conversaciones: number }[];
  por_plataforma: { plataforma: string; inversion: number }[];
  por_mes: { mes: string; plataforma: string; inversion: number }[];
  campanas_meta: { campana: string; inversion: number; clics: number; conversaciones: number; costo: number | null }[];
  campanas_gads: { campana: string; inversion: number; clics: number; conversiones: number; costo: number | null }[];
}
export interface Inversion { total: number; total_ant: number }
export interface CostoFijo {
  id: number; plataforma: string; monto: number; moneda: 'COP' | 'USD'; desde: string; hasta: string | null; nota: string;
  actualizado_por: string; actualizado: string;
}
export type Cobro = 'mensual' | 'anual' | 'prepago' | 'consumo' | 'gratis';
export type EstadoCosto = 'activo' | 'prueba' | 'suspendido' | 'por_confirmar';
export interface Suscripcion extends CostoFijo {
  categoria: string; para_que: string; cobro: Cobro; estado: EstadoCosto; proximo_pago: string | null; ultimo_pago: string | null;
  ultimo_pago_monto: number | null; ultimo_pago_estado: string; metodo_pago: string; suma_inversion: boolean; cop_mes: number; gasto_mes: number;
}
export interface Gasto { id: number; plataforma: string; fecha: string; monto: number; moneda: 'COP' | 'USD'; concepto: string; suma_inversion: boolean; cop: number }
export interface Pago {
  id: number; plataforma: string; fecha: string; monto: number; moneda: 'COP' | 'USD'; estado: 'pagado' | 'pendiente' | 'fallido';
  referencia: string; nota: string; cop: number;
}
export interface Costos {
  mes: string; corte: string; trm: number | null; suscripciones: Suscripcion[]; gastos: Gasto[]; pagos: Pago[];
  explee: { usd: number; cop: number; enviados: number }; pauta: { meta: number; gads: number };
  por_plataforma: { plataforma: string; cop: number }[]; total: number; fuera_marketing: number;
}

export interface General {
  hoy: string; mes_actual: string; ultimo_mes: string; inicio: string; minimo: number; margen: number; ultimo_dia: string | null;
  lista_clientes: string[];
  facturacion: { id: number; mes: string; cliente: string; valor: number; moneda: 'COP' | 'USD'; nota: string }[];
  serie: { mes: string; servicios: number; activos: number; nuevos: number; perdidos: number; reactivados: number }[];
  hero: { ultimo: number | null; anterior: number | null; hace_un_ano: number | null; actual: number | null; proyeccion: number | null; record: number | null; record_mes: string | null };
  crecimiento: { mom: number | null; cmgr3: number | null; cmgr6: number | null; cmgr12: number | null; ttm: number | null; ttm_anterior: number | null; anual: number | null; cagr: number | null; cagr_desde: string };
  clientes: { activos: number | null; activos_ant: number | null; activos_hace_un_ano: number | null; nuevos_3m: number | null; perdidos_3m: number | null;
    churn_ultimo: number | null; churn_3m: number | null; churn_12m: number | null };
  retencion: { nrr: number | null; grr: number | null; clientes: number; siguen: number; logos: number | null };
  quick_ratio: { nuevos: number; expansion: number; contraccion: number; perdida: number; ratio: number | null };
  concentracion: { top1: number | null; top1_cliente: string | null; top5: number | null; top: { cliente: string; servicios: number; pct: number }[] | null };
  cohortes: { trimestre: string; clientes: number; retencion: Record<string, number> }[];
  embudo: { desde: string; etapas: { etapa: string; oportunidades: number }[] };
  cac: { inversion_90: number; clientes_90: number; reuniones_90: number; nuevos_plataforma_90: number };
  ingresos: { meses_cargados: number; mrr: number | null; mrr_ant: number | null; clientes_facturados: number; nrr: number | null; serie: { mes: string; mrr: number }[] };
}

export interface Email {
  kpis: Kpis;
  serie: { fecha: string; enviados: number; aperturas: number; clics: number }[];
  secuencias: { secuencia: string; enviados: number; entregados: number; aperturas: number; clics: number; tasa_apertura: number | null; tasa_clics: number | null }[];
  correos: { asunto: string; secuencia: string; enviados: number; aperturas: number; clics: number; tasa_apertura: number | null }[];
  campanas: { fecha: string; campana: string; enviados: number; entregados: number; aperturas: number; clics: number; desuscritos: number; tasa_apertura: number | null; tasa_clics: number | null }[];
  clics_desde_correos: { correo: string; clic_a: string; clics: number; personas: number }[];
  visitas_desde_correos: { correo: string; visitas: number; conversiones: number }[];
}
export interface Prospeccion {
  kpis: Kpis;
  serie: { fecha: string; enviados: number; respuestas: number }[];
  campanas: { campana: string; enviados: number; respuestas: number; leads: number; tasa_respuesta: number | null; gasto: number; costo_lead: number | null }[];
  leads: { fecha: string | null; campana: string; empresa: string; cargo: string; pais: string; nombre: string; correo: string; telefono: string; linkedin: string; motivo: string }[];
  agenda_por_campana: { campana: string; clics: number; personas: number }[];
  visitas_por_campana: { campana: string; visitas: number; conversiones: number }[];
}
export interface Accionador {
  id: number; plataforma: string; tipo: string; accionador: string; enlace: string; que_hace: string; donde_se_ve: string;
  donde_se_usa: string; actualizado_por: string; actualizado: string;
}
export interface Propuesta {
  id: number; cliente: string; documento: string; tipo: string; enlace: string; fecha: string | null; notas: string;
  actualizado_por: string; actualizado: string;
}

export type Prioridad = 'alta' | 'media' | 'baja';
export type EstadoPendiente = 'nuevo' | 'hecho' | 'descartado' | 'accion';
export interface PendienteMisha {
  id: number; titulo: string; resumen: string; remitente: string; correo_url: string; correo_id: string; fecha_correo: string | null;
  prioridad: Prioridad; estado: EstadoPendiente; instruccion: string; respuesta: string; instruccion_atendida: boolean;
  creado: string; actualizado: string;
}

export interface Embudo {
  kpis: Kpis;
  etapas: { etapa: string; tipo: string; oportunidades: number; valor: number }[];
  por_origen: { origen: string; nuevas: number; agendadas: number; hechas: number; clientes: number; inversion: number; costo_reunion: number | null; costo_cliente: number | null }[];
  tiempos: { a_agendada: number | null; a_hecha: number | null; a_cliente: number | null };
  serie: { fecha: string; nuevas: number; agendadas: number }[];
  perdidas: { motivo: string; oportunidades: number }[];
  recientes: { fecha: string; nombre: string; etapa: string; origen: string; campana: string; responsable: string; valor: number }[];
}

export interface Agente {
  kpis: Kpis;
  serie: { fecha: string; conversaciones: number; respuestas: number; seguimientos: number }[];
  guion?: { orden: number; paso: string; conversaciones: number; tasa: number | null }[];
  sin_respuesta?: { ultimo: string; nombre: string; origen: string; etapa: string; ultimo_mensaje: string; kommo: string }[];
  conversaciones: { lead_id: number; nombre: string; origen: string; etapa: string; recibidos: number; respuestas: number; paso: string; correo: string; traspaso: string; seguimiento: string; ultimo_mensaje: string; ultimo: string; kommo: string }[];
  por_origen: { origen: string; atendidas: number; correos: number; reuniones: number; traspasos: number }[];
}

// Operaciones › Servicios (supabase/022_servicios_plataforma.sql). La serie es por mes (fecha = día 1).
export interface Servicios {
  ultimo_dia: string | null;
  kpis: Kpis;
  serie: { fecha: string; servicios: number; clientes: number }[];
  por_cliente: { cliente: string; este_mes: number; mes_anterior: number; periodo: number; promedio: number; ultimo: string }[];
  por_tipo: { tipo: string; este_mes: number; periodo: number }[];
  por_estado: { estado: string; este_mes: number; periodo: number }[];
  por_cliente_mes: { mes: string; cliente: string; servicios: number }[];
}
// Operaciones › Servicios, vista "Por días" (supabase/023_servicios_por_dias.sql).
export interface ServiciosDias {
  ultimo_dia: string | null;
  kpis: Kpis;
  serie: { fecha: string; servicios: number; finalizados: number }[];
  por_cliente: { cliente: string; servicios: number; servicios_ant: number; finalizados: number; cancelados: number; tasa_finalizados: number | null }[];
  por_tipo: { tipo: string; servicios: number; servicios_ant: number }[];
  por_estado: { estado: string; servicios: number; servicios_ant: number }[];
}

// Operaciones › Gastos (supabase/027_facturas_proveedores.sql): una pestaña por proveedor.
export interface FacturaProveedor { id: string; cuenta: string; numero: string; fecha: string; monto: number | null; moneda: string; archivo: string; correo_url: string }
export interface MovimientoProveedor { fecha: string; cuenta: string; tipo: 'pago' | 'rechazo'; monto: number | null; moneda: string; detalle: string; correo_url: string }
export interface Gastos { kpis: Kpis & { ultimo_pago: string | null; ultimo_rechazo: string | null }; facturas: FacturaProveedor[]; movimientos: MovimientoProveedor[] }
