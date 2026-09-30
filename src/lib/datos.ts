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
