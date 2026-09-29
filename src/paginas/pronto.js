// Páginas que llegan en las siguientes etapas del plan (T2 a T4).
import { esc } from '../formato.js';

const pronto = (id, titulo, etapa, sub, puntos) => ({
  id, titulo, etapa, sub, pronto: true,
  render(main) {
    main.innerHTML = `<section class="tarjeta pronto-caja"><header><h2>Llega en ${esc(etapa)}</h2></header>
      <p>${esc(sub)}.</p><ul>${puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
      <p class="nota">Mientras tanto, esta información sigue en Data Studio.</p></section>`;
  },
});

export const proximas = [
  pronto('embudo', 'Embudo', 'T4', 'De la inversión a la venta, por origen, con los datos de Kommo', [
    'Oportunidades por etapa: nuevo, calificado, reunión agendada, reunión hecha, cliente',
    'Costo por reunión y por cliente según el origen',
    'Tiempo promedio entre etapas']),
  pronto('pauta', 'Pauta', 'T2', 'Google Ads y Meta Ads conectados directo, sin Windsor', [
    'Inversión, clics, conversaciones de WhatsApp y costo por conversación por campaña',
    'Total de inversión en pesos, con las herramientas (Brevo, Explee)',
    'Inversión por plataforma y mes']),
  pronto('email', 'Email marketing', 'T3', 'Brevo conectado directo por su API', [
    'Enviados, aperturas y clics por automatización y por correo',
    'Clics desde los correos a WhatsApp y a la agenda',
    'Inversión en Brevo']),
  pronto('prospeccion', 'Prospección', 'T3', 'Explee conectado directo por su API', [
    'Correos, respuestas, leads calientes y gasto por campaña',
    'Visitas y clics a la agenda desde cada campaña',
    'Costo por lead caliente']),
  pronto('accionadores', 'Accionadores', 'T3', 'Referencia de todo lo que suma datos en Analytics, editable desde el tablero', [
    'Enlaces medidos, eventos del sitio y datos personalizados',
    'Plataforma donde se usa cada uno, con su enlace listo para copiar']),
];
