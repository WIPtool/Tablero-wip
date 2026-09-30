'use client';

// Alterna entre claro y oscuro y lo recuerda en este navegador.
export function BotonTema() {
  function cambiar() {
    const raiz = document.documentElement;
    const nuevo = raiz.dataset.theme === 'dark' ? 'light' : 'dark';
    raiz.dataset.theme = nuevo;
    try { localStorage.setItem('tablero_tema', nuevo); } catch { /* sin almacenamiento */ }
  }
  return (
    <button type="button" onClick={cambiar} className="rounded-lg border border-white/15 px-2.5 py-1.5 text-left text-lateral-tinta hover:border-white/40">
      Cambiar tema
    </button>
  );
}
