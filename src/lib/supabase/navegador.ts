import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_CLAVE } from '@/lib/config';

// Cliente de Supabase para el navegador. Solo se usa para iniciar el acceso con Google.
export const clienteNavegador = () => createBrowserClient(SUPABASE_URL, SUPABASE_CLAVE);
