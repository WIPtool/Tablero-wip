// Páginas del tablero. Las "próximas" llegan en las siguientes etapas del plan.
export interface Pagina { id: string; titulo: string; sub: string; etapa?: string; puntos?: string[] }

export const PAGINAS: Pagina[] = [
  { id: 'resumen', titulo: 'Resumen', sub: 'Visitas al sitio, conversiones y de dónde llegan' },
  { id: 'sitio', titulo: 'Sitio web', sub: 'Qué hace la gente en wiptool.com' },
  { id: 'seo', titulo: 'SEO sitio web', sub: 'Cómo nos encuentran en Google: wiptool.com' },
  { id: 'seo-plataforma', titulo: 'SEO plataforma', sub: 'Cómo nos encuentran en Google: platform.wiptool.com' },
  { id: 'pauta', titulo: 'Pauta', sub: 'Meta Ads, Google Ads e inversión total en pesos' },
  { id: 'email', titulo: 'Email marketing', sub: 'Correos de Brevo: automatizaciones, campañas y clics' },
  { id: 'prospeccion', titulo: 'Prospección', sub: 'Correos en frío de Explee: respuestas, leads calientes y costo' },
  { id: 'embudo', titulo: 'Embudo', sub: 'Oportunidades de Kommo por etapa y origen, y lo que cuesta cada reunión y cada cliente' },
  { id: 'costos', titulo: 'Costos fijos', sub: 'Suscripciones que suman a la inversión (Brevo y demás)' },
  { id: 'accionadores', titulo: 'Accionadores', sub: 'Enlaces medidos, eventos y datos que suman información en Analytics' },
];

export const PROXIMAS: Pagina[] = [];

export const buscarPagina = (id: string) => [...PAGINAS, ...PROXIMAS].find((p) => p.id === id);
