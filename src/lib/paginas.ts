// Páginas del tablero, en dos secciones que se cambian con el selector de la barra lateral:
// Marketing (sitio, pauta, correo, embudo…) y Operaciones (uso de la plataforma WIP, con datos de su base MongoDB).
export type Seccion = 'marketing' | 'operaciones';
export interface Pagina { id: string; titulo: string; sub: string; seccion?: Seccion; etapa?: string; puntos?: string[] }

export const SECCIONES: { id: Seccion; titulo: string; inicio: string }[] = [
  { id: 'marketing', titulo: 'Marketing', inicio: 'resumen' },
  { id: 'operaciones', titulo: 'Operaciones', inicio: 'servicios' },
];

export const PAGINAS: Pagina[] = [
  { id: 'resumen', titulo: 'Resumen', sub: 'Visitas al sitio, conversiones y de dónde llegan' },
  { id: 'sitio', titulo: 'Sitio web', sub: 'Qué hace la gente en wiptool.com' },
  { id: 'seo', titulo: 'SEO sitio web', sub: 'Cómo nos encuentran en Google: wiptool.com' },
  { id: 'seo-plataforma', titulo: 'SEO plataforma', sub: 'Cómo nos encuentran en Google: platform.wiptool.com' },
  { id: 'pauta', titulo: 'Pauta', sub: 'Meta Ads, Google Ads e inversión total en pesos' },
  { id: 'email', titulo: 'Email marketing', sub: 'Correos de Brevo: automatizaciones, campañas y clics' },
  { id: 'prospeccion', titulo: 'Prospección', sub: 'Correos en frío de Explee: respuestas, leads calientes y costo' },
  { id: 'embudo', titulo: 'Embudo', sub: 'Oportunidades de Kommo por etapa y origen, y lo que cuesta cada reunión y cada cliente' },
  { id: 'agente', titulo: 'Agente de WhatsApp', sub: 'Conversaciones que atiende el agente con Claude: respuestas, traspasos a una persona y reuniones' },
  { id: 'costos', titulo: 'Costos fijos', sub: 'Suscripciones que suman a la inversión (Brevo y demás)' },
  { id: 'links', titulo: 'Links de interés', sub: 'Accionadores que suman datos en Analytics y propuestas enviadas a clientes' },
  { id: 'servicios', titulo: 'Servicios', sub: 'Servicios que se crean cada mes en la plataforma WIP, en total y por cliente', seccion: 'operaciones' },
];

export const PROXIMAS: Pagina[] = [];

export const seccionDe = (p?: Pagina): Seccion => p?.seccion ?? 'marketing';
export const buscarPagina = (id: string) => [...PAGINAS, ...PROXIMAS].find((p) => p.id === id);
