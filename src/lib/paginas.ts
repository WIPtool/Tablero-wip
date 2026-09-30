// Páginas del tablero. Las "pronto" llegan en las siguientes etapas del plan (T2 a T4).
export interface Pagina { id: string; titulo: string; sub: string; etapa?: string; puntos?: string[] }

export const PAGINAS: Pagina[] = [
  { id: 'resumen', titulo: 'Resumen', sub: 'Visitas al sitio, conversiones y de dónde llegan' },
  { id: 'sitio', titulo: 'Sitio web', sub: 'Qué hace la gente en wiptool.com' },
  { id: 'seo', titulo: 'SEO sitio web', sub: 'Cómo nos encuentran en Google: wiptool.com' },
  { id: 'seo-plataforma', titulo: 'SEO plataforma', sub: 'Cómo nos encuentran en Google: platform.wiptool.com' },
];

export const PROXIMAS: Pagina[] = [
  { id: 'embudo', titulo: 'Embudo', etapa: 'T4', sub: 'De la inversión a la venta, por origen, con los datos de Kommo', puntos: [
    'Oportunidades por etapa: nuevo, calificado, reunión agendada, reunión hecha, cliente',
    'Costo por reunión y por cliente según el origen',
    'Tiempo promedio entre etapas'] },
  { id: 'pauta', titulo: 'Pauta', etapa: 'T2', sub: 'Google Ads y Meta Ads conectados directo, sin Windsor', puntos: [
    'Inversión, clics, conversaciones de WhatsApp y costo por conversación por campaña',
    'Total de inversión en pesos, con las herramientas (Brevo, Explee)',
    'Inversión por plataforma y mes'] },
  { id: 'email', titulo: 'Email marketing', etapa: 'T3', sub: 'Brevo conectado directo por su API', puntos: [
    'Enviados, aperturas y clics por automatización y por correo',
    'Clics desde los correos a WhatsApp y a la agenda',
    'Inversión en Brevo'] },
  { id: 'prospeccion', titulo: 'Prospección', etapa: 'T3', sub: 'Explee conectado directo por su API', puntos: [
    'Correos, respuestas, leads calientes y gasto por campaña',
    'Visitas y clics a la agenda desde cada campaña',
    'Costo por lead caliente'] },
  { id: 'accionadores', titulo: 'Accionadores', etapa: 'T3', sub: 'Referencia de todo lo que suma datos en Analytics, editable desde el tablero', puntos: [
    'Enlaces medidos, eventos del sitio y datos personalizados',
    'Plataforma donde se usa cada uno, con su enlace listo para copiar'] },
];

export const buscarPagina = (id: string) => [...PAGINAS, ...PROXIMAS].find((p) => p.id === id);
