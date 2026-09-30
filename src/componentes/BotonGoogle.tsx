'use client';

import { useState } from 'react';
import { clienteNavegador } from '@/lib/supabase/navegador';

export function BotonGoogle() {
  const [error, setError] = useState('');
  const [yendo, setYendo] = useState(false);

  async function entrar() {
    setYendo(true);
    const { error } = await clienteNavegador().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        queryParams: { hd: 'wiptool.com', prompt: 'select_account' },
      },
    });
    if (error) {
      setError('No se pudo abrir el acceso con Google: ' + error.message);
      setYendo(false);
    }
  }

  return (
    <>
      {error && <p className="rounded-lg border border-malo/40 bg-malo/10 px-3 py-2 text-[13px] text-[#ffd9d5]">{error}</p>}
      <button
        type="button"
        onClick={entrar}
        disabled={yendo}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-lima px-5 py-3 font-semibold text-navy transition hover:brightness-95 disabled:opacity-70"
      >
        {yendo ? 'Abriendo Google…' : 'Entrar con Google'}
      </button>
    </>
  );
}
