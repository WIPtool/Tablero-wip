import { NextResponse, type NextRequest } from 'next/server';
import { clienteServidor } from '@/lib/supabase/servidor';
import { esDelEquipo } from '@/lib/config';

// Google vuelve aquí después de elegir la cuenta. Se canjea el código por la sesión y se revisa el dominio.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const volver = (error: string) => NextResponse.redirect(`${origin}/entrar?error=${encodeURIComponent(error)}`);

  const errorGoogle = searchParams.get('error_description') || searchParams.get('error');
  if (errorGoogle) return volver(errorGoogle);

  const codigo = searchParams.get('code');
  if (!codigo) return NextResponse.redirect(`${origin}/entrar`);

  const supabase = await clienteServidor();
  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);
  if (error) return volver(error.message);

  const email = data.user?.email?.toLowerCase() ?? '';
  if (!esDelEquipo(email)) {
    await supabase.auth.signOut();
    return volver(`La cuenta ${email} no es de WIP. Entra con tu correo @wiptool.com`);
  }
  return NextResponse.redirect(`${origin}/resumen`);
}
