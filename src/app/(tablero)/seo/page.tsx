import type { Metadata } from 'next';
import { PaginaSeo } from '@/componentes/PaginaSeo';
import { leerRango, type ParametrosBusqueda } from '@/lib/rango';

export const metadata: Metadata = { title: 'SEO sitio web' };

export default async function SeoSitio({ searchParams }: { searchParams: Promise<ParametrosBusqueda> }) {
  return <PaginaSeo id="seo" sitio="wiptool.com" rango={leerRango(await searchParams)} />;
}
