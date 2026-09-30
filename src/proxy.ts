import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_URL, SUPABASE_CLAVE, MODO_EJEMPLO, esDelEquipo } from '@/lib/config';

// Se ejecuta antes de cada página: renueva la sesión de Supabase (cookies) y manda a /entrar
// a quien no haya iniciado sesión con una cuenta @wiptool.com.
export async function proxy(request: NextRequest) {
  if (MODO_EJEMPLO) return NextResponse.next();

  let respuesta = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CLAVE, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined) ?? null;
  const ruta = request.nextUrl.pathname;
  const publica = ruta === '/entrar' || ruta.startsWith('/auth/');

  if (!esDelEquipo(email) && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = '';
    const redireccion = NextResponse.redirect(url);
    respuesta.cookies.getAll().forEach((c) => redireccion.cookies.set(c));
    return redireccion;
  }
  return respuesta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|img/|robots.txt).*)'],
};
