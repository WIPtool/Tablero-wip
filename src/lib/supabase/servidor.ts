import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_CLAVE } from '@/lib/config';

// Cliente de Supabase para componentes y rutas del servidor: usa la sesión guardada en las cookies,
// así las consultas llevan la identidad de la persona y aplican las reglas de la base.
export async function clienteServidor() {
  const almacen = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_CLAVE, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Desde un componente de servidor no se pueden escribir cookies; lo hace proxy.ts.
        }
      },
    },
  });
}
