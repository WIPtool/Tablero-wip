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
  { id: 'costos', titulo: 'Costos fijos', sub: 'Suscripciones que suman a la inversión (Brevo y demás)' },
  { id: 'accionadores', titulo: 'Accionadores', sub: 'Enlaces medidos, eventos y datos que suman información en Analytics' },
];

export const PROXIMAS: Pagina[] = [
  { id: 'embudo', titulo: 'Embudo', etapa: 'T4', sub: 'De la inversión a la venta, por origen, con los datos de Kommo', puntos: [
    'Oportunidades por etapa: nuevo, calificado, reunión agendada, reunión hecha, cliente',
    'Costo por reunión y por cliente según el origen',
    'Tiempo promedio entre etapas'] },
];

export const buscarPagina = (id: string) => [...PAGINAS, ...PROXIMAS].find((p) => p.id === id);
