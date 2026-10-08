import { redirect } from 'next/navigation';

// La página de accionadores ahora es una pestaña de "Links de interés"; se mantiene la ruta vieja para enlaces guardados.
export default function PaginaAccionadores() {
  redirect('/links?ver=accionadores');
}
