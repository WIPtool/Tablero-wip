import { NextResponse, type NextRequest } from 'next/server';
import { clienteServidor } from '@/lib/supabase/servidor';

// Cierra la sesión (formulario POST desde la barra lateral).
export async function POST(request: NextRequest) {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/entrar', request.url), { status: 303 });
}
