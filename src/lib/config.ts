// Proyecto de Supabase "tablero-wip". La clave publicable es pública por diseño (viaja al navegador):
// el acceso real lo controlan las reglas de la base, que solo dejan leer a cuentas @wiptool.com.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tlpnkcroqenudzgiqzum.supabase.co';
export const SUPABASE_CLAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_PmKPJyqbHGuyiRP5QKskTg_YfPBxARV';

export const DOMINIO_EQUIPO = '@wiptool.com';
export const esDelEquipo = (email?: string | null) => !!email && email.toLowerCase().endsWith(DOMINIO_EQUIPO);

// Modo de ejemplo: cifras inventadas y sin inicio de sesión. Solo para desarrollo local (TABLERO_DEMO=1).
export const MODO_EJEMPLO = process.env.TABLERO_DEMO === '1' && process.env.NODE_ENV !== 'production';
