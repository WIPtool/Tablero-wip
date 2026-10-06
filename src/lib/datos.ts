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
  conversaciones: { lead_id: number; nombre: string; origen: string; etapa: string; recibidos: number; respuestas: number; traspaso: string; seguimiento: string; ultimo_mensaje: string; ultimo: string; kommo: string }[];
  por_origen: { origen: string; atendidas: number; reuniones: number; traspasos: number }[];
}
