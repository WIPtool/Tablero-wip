// Acceso a los datos: Supabase si está configurado; si no, el modo de ejemplo.
// Las respuestas se guardan en memoria para que cambiar de página sea instantáneo.
import { createClient } from '@supabase/supabase-js';
import { demo } from './demo.js';

// Proyecto de Supabase "tablero-wip". La clave publicable es pública por diseño (va en el navegador);
// quien controla el acceso son las reglas de la base: solo cuentas @wiptool.com leen datos.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://tlpnkcroqenudzgiqzum.supabase.co';
const CLAVE = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_PmKPJyqbHGuyiRP5QKskTg_YfPBxARV';
const pedirDemo = new URLSearchParams(location.search).has('demo') && ['localhost', '127.0.0.1'].includes(location.hostname);

export const modoEjemplo = !URL || !CLAVE || pedirDemo;
export const supabase = modoEjemplo ? null : createClient(URL, CLAVE, { auth: { persistSession: true, detectSessionInUrl: true } });

const cache = new Map();

export async function pedir(funcion, params = {}) {
  const clave = funcion + JSON.stringify(params);
  if (cache.has(clave)) return cache.get(clave);
  const promesa = (async () => {
    if (modoEjemplo) {
      await new Promise((r) => setTimeout(r, 180)); // simula la red para ver los estados de carga
      return demo[funcion](params);
    }
    const { data, error } = await supabase.rpc(funcion, params);
    if (error) throw new Error(error.message);
    return data;
  })();
  cache.set(clave, promesa);
  promesa.catch(() => cache.delete(clave));
  return promesa;
}

export const limpiarCache = () => cache.clear();
