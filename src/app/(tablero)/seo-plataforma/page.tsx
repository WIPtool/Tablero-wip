import type { Metadata } from 'next';
import { PaginaSeo } from '@/componentes/PaginaSeo';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'SEO plataforma' };

export default async function SeoPlataforma({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  return <PaginaSeo id="seo-plataforma" sitio="platform.wiptool.com" rango={leerRango(await searchParams)} />;
}
