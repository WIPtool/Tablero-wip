// Modo de ejemplo: cifras inventadas con la misma forma que devuelven las funciones de Supabase.
// Se usa mientras no hay base conectada. Son deterministas (la misma fecha da siempre el mismo número)
// para que el periodo anterior y los cambios se vean coherentes.
import { sumarDias, diasEntre, hoyBogota, anterior } from './rango';

function azar(semilla) {
  let h = 2166136261;
  for (const c of String(semilla)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dia(fecha) {
  const r = azar('d' + fecha);
  const sem = new Date(fecha + 'T00:00:00Z').getUTCDay();
  const finde = sem === 0 || sem === 6 ? 0.55 : 1;
  const tendencia = 1 + (diasEntre('2026-01-01', fecha) / 365) * 0.35;
  const visitas = Math.max(0, Math.round((10 + r() * 9) * finde * tendencia));
  const conversiones = Math.max(0, Math.round(visitas * (0.06 + r() * 0.1) - 0.3));
  const rg = azar('g' + fecha);
  const clics = Math.round((2 + rg() * 5) * finde * tendencia);
  const impresiones = Math.round((190 + rg() * 160) * (0.8 + 0.2 * finde) * tendencia);
  const clicsP = Math.round(1 + rg() * 4);
  const impresionesP = Math.round(60 + rg() * 60);
  return { visitas, conversiones, clics, impresiones, pos: 18 + rg() * 8, clicsP, impresionesP, posP: 10 + rg() * 4 };
}

function dias(desde, hasta) {
  const out = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
}
const suma = (fechas, campo) => fechas.reduce((a, f) => a + dia(f)[campo], 0);

// Reparte un total según pesos, con redondeo que conserva el total.
function repartir(total, filas, semilla) {
  const r = azar(semilla);
  const pesos = filas.map((f) => f.peso * (0.85 + r() * 0.3));
  const s = pesos.reduce((a, b) => a + b, 0);
  const crudos = pesos.map((p) => (total * p) / s);
  const enteros = crudos.map(Math.floor);
  let resto = total - enteros.reduce((a, b) => a + b, 0);
  crudos.map((c, i) => [c - Math.floor(c), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (resto-- > 0) enteros[i]++; });
  return filas.map((f, i) => ({ ...f, valor: enteros[i] }));
}

const CANALES = [
  ['Directo', 0.5, 0.35], ['Google orgánico', 0.28, 0.02], ['Redes sociales', 0.08, 0.06], ['APP SBS vieja', 0.045, 0.08],
  ['Google Ads', 0.03, 0.01], ['Explee (prospección)', 0.02, 0.08], ['Asistentes de IA', 0.013, 0.03], ['Sin asignar', 0.012, 0.3],
  ['App sin app', 0.01, 0.01], ['Correo (Brevo)', 0.008, 0.06],
];

function resumen({ p_desde, p_hasta }) {
  const f = dias(p_desde, p_hasta);
  const a = anterior({ desde: p_desde, hasta: p_hasta });
  const fa = dias(a.desde, a.hasta);
  const ultimoGsc = sumarDias(hoyBogota(), -3);
  const fg = f.filter((x) => x <= ultimoGsc), fga = fa.filter((x) => x <= ultimoGsc);
  const visitas = suma(f, 'visitas'), conversiones = suma(f, 'conversiones');
  const s = p_desde + p_hasta;
  const vis = repartir(visitas, CANALES.map(([canal, peso]) => ({ canal, peso })), 'cv' + s);
  const conv = repartir(conversiones, CANALES.map(([canal, , peso]) => ({ canal, peso })), 'cc' + s);
  const tipos = repartir(conversiones, [
    { tipo: 'click_whatsapp', peso: 0.62 }, { tipo: 'click_calendly', peso: 0.24 },
    { tipo: 'formulario_contacto', peso: 0.09 }, { tipo: 'inscripcion_enviada', peso: 0.05 },
  ], 'ct' + s).filter((x) => x.valor > 0).map((x) => ({ tipo: x.tipo, conversiones: x.valor }));
  const clics = repartir(Math.round(conversiones * 0.95), [
    { origen: 'Sitio web', clic_a: 'WhatsApp', peso: 0.4 }, { origen: 'Instagram', clic_a: 'WhatsApp', peso: 0.19 },
    { origen: 'Explee', clic_a: 'Agenda', peso: 0.16 }, { origen: 'Sitio web', clic_a: 'Agenda', peso: 0.11 },
    { origen: 'Correo (Brevo)', clic_a: 'WhatsApp', peso: 0.06 }, { origen: 'Facebook', clic_a: 'WhatsApp', peso: 0.04 },
    { origen: 'Correo (Brevo)', clic_a: 'Agenda', peso: 0.04 },
  ], 'co' + s).filter((x) => x.valor > 0)
    .map((x) => ({ origen: x.origen, clic_a: x.clic_a, clics: x.valor, personas: Math.max(1, Math.round(x.valor * 0.8)) }));
  const citas = repartir(Math.round(conversiones * 0.12), [
    { origen: 'Explee', peso: 0.45 }, { origen: 'Sitio web', peso: 0.35 }, { origen: 'Instagram', peso: 0.2 },
  ], 'ci' + s).filter((x) => x.valor > 0).map((x) => ({ origen: x.origen, citas: x.valor, personas: x.valor }));
  const asa = vis.find((x) => x.canal === 'App sin app').valor;
  const app = repartir(asa, [{ cliente: 'Asistencias Viales Equirent', peso: 0.5 }, { cliente: 'VANTI', peso: 0.3 }, { cliente: 'Sin cliente', peso: 0.2 }], 'as' + s)
    .filter((x) => x.valor > 0).map((x) => ({ cliente: x.cliente, visitas: x.valor, conversiones: 0 }));
  return {
    kpis: {
      visitas, visitas_ant: suma(fa, 'visitas'), conversiones, conversiones_ant: suma(fa, 'conversiones'),
      clics_google: suma(fg, 'clics'), clics_google_ant: suma(fga, 'clics'),
      impresiones: suma(fg, 'impresiones'), impresiones_ant: suma(fga, 'impresiones'),
    },
    serie: f.map((fecha) => ({ fecha, visitas: dia(fecha).visitas, conversiones: dia(fecha).conversiones })),
    conversiones_por_tipo: tipos,
    canales: vis.map((x, i) => ({ canal: x.canal, visitas: x.valor, conversiones: conv[i].valor }))
      .filter((x) => x.visitas || x.conversiones).sort((a, b) => b.visitas - a.visitas),
    clics_por_origen: clics.sort((a, b) => b.clics - a.clics),
    citas_por_origen: citas,
    app_sin_app: app,
  };
}

const PAGINAS = ['/', '/equipos', '/blog/orden-de-trabajo', '/academy', '/landing/sbs', '/inscripcion', '/blog/modelo-de-negocio-de-uber',
  '/contacto', '/software-gestion-servicios-en-campo', '/blog/que-es-uberizacion', '/software-empresas-de-asistencia', '/ebook/uberizacion',
  '/blog/gestion-de-flotas-de-servicio', '/software-para-gruas-y-flotas', '/blog/que-es-gps-tracker'];
const PAISES = ['Colombia', 'México', 'Estados Unidos', 'República Dominicana', 'Perú', 'Ecuador', 'Guatemala', 'Argentina', 'Chile', 'Panamá'];

function sitio({ p_desde, p_hasta }) {
  const f = dias(p_desde, p_hasta);
  const visitas = suma(f, 'visitas'), conversiones = suma(f, 'conversiones');
  const s = p_desde + p_hasta;
  const pv = repartir(visitas, PAGINAS.map((pagina, i) => ({ pagina, peso: i === 0 ? 8 : 1 / (i + 0.6) })), 'pv' + s);
  const pc = repartir(conversiones, PAGINAS.map((pagina, i) => ({ pagina, peso: i === 0 ? 5 : 0.3 / (i + 1) })), 'pc' + s);
  const av = repartir(visitas, PAISES.map((pais, i) => ({ pais, peso: i === 0 ? 12 : 1 / (i + 0.5) })), 'av' + s);
  const ac = repartir(conversiones, PAISES.map((pais, i) => ({ pais, peso: i === 0 ? 10 : 0.2 / (i + 1) })), 'ac' + s);
  const dv = repartir(visitas, [{ d: 'Computador', peso: 0.71 }, { d: 'Celular', peso: 0.28 }, { d: 'Tableta', peso: 0.01 }], 'dv' + s);
  const dc = repartir(conversiones, [{ d: 'Computador', peso: 0.86 }, { d: 'Celular', peso: 0.14 }, { d: 'Tableta', peso: 0 }], 'dc' + s);
  return {
    paginas: pv.map((x, i) => ({ pagina: x.pagina, visitas: x.valor, conversiones: pc[i].valor })).filter((x) => x.visitas).sort((a, b) => b.visitas - a.visitas),
    paises: av.map((x, i) => ({ pais: x.pais, visitas: x.valor, conversiones: ac[i].valor })).filter((x) => x.visitas).sort((a, b) => b.visitas - a.visitas),
    dispositivos: dv.map((x, i) => ({ dispositivo: x.d, visitas: x.valor, conversiones: dc[i].valor })).filter((x) => x.visitas),
  };
}

const CONSULTAS = {
  'wiptool.com': ['wip', 'software gestion servicios en campo', 'orden de trabajo', 'modelo de negocio de uber', 'que es uberizacion',
    'software para gruas', 'gestion de flotas de servicio', 'wip tool', 'software de asistencia vial', 'que es gps tracker',
    'app para tecnicos en campo', 'formato orden de trabajo', 'software empresas de asistencia', 'uberizacion de servicios'],
  'platform.wiptool.com': ['wip', 'wip bavaria', 'wip platform', 'w.i.p.', 'wip app', 'wip login', 'wip tool', 'wip tools', 'wip portal'],
};
const PAGS_SEO = {
  'wiptool.com': ['https://www.wiptool.com/', 'https://www.wiptool.com/blog/orden-de-trabajo', 'https://www.wiptool.com/equipos',
    'https://www.wiptool.com/blog/modelo-de-negocio-de-uber', 'https://www.wiptool.com/software-gestion-servicios-en-campo',
    'https://www.wiptool.com/blog/que-es-uberizacion', 'https://www.wiptool.com/software-para-gruas-y-flotas'],
  'platform.wiptool.com': ['https://platform.wiptool.com/', 'https://platform.wiptool.com/register', 'https://platform.wiptool.com/forgotPassword'],
};

function seo({ p_desde, p_hasta, p_sitio }) {
  const plat = p_sitio === 'platform.wiptool.com';
  const ultimo = sumarDias(hoyBogota(), -3);
  const f = dias(p_desde, p_hasta < ultimo ? p_hasta : ultimo);
  const a = anterior({ desde: p_desde, hasta: p_hasta });
  const fa = dias(a.desde, a.hasta);
  const kC = plat ? 'clicsP' : 'clics', kI = plat ? 'impresionesP' : 'impresiones', kP = plat ? 'posP' : 'pos';
  const posMedia = (fs) => { const i = suma(fs, kI); return i ? fs.reduce((acc, x) => acc + dia(x)[kP] * dia(x)[kI], 0) / i : null; };
  const clics = suma(f, kC), impresiones = suma(f, kI);
  const s = p_desde + p_hasta + p_sitio;
  const lista = (nombres, clave, sem) => {
    const c = repartir(clics, nombres.map((n, i) => ({ n, peso: 1 / (i + 0.7) ** 1.3 })), sem + 'c');
    const im = repartir(impresiones, nombres.map((n, i) => ({ n, peso: 1 / (i + 0.9) })), sem + 'i');
    const r = azar(sem + 'p');
    return c.map((x, i) => ({ [clave]: x.n, clics: x.valor, impresiones: Math.max(im[i].valor, x.valor), posicion: (plat ? 3 : 6) + r() * 18 }))
      .sort((p, q) => q.clics - p.clics || q.impresiones - p.impresiones);
  };
  return {
    ultimo_dia: ultimo,
    kpis: { clics, impresiones, posicion: posMedia(f), clics_ant: suma(fa, kC), impresiones_ant: suma(fa, kI), posicion_ant: posMedia(fa) },
    serie: f.map((fecha) => ({ fecha, clics: dia(fecha)[kC], impresiones: dia(fecha)[kI] })),
    consultas: lista(CONSULTAS[p_sitio], 'consulta', 'q' + s),
    paginas: lista(PAGS_SEO[p_sitio], 'pagina', 'pg' + s),
  };
}

function estado() {
  const hace = (min) => new Date(Date.now() - min * 60000).toISOString();
  return [
    { fuente: 'ga4', actualizado: hace(14), filas: 312, estado: 'ok', mensaje: '' },
    { fuente: 'gsc', actualizado: hace(260), filas: 1480, estado: 'ok', mensaje: '' },
  ];
}

export const demo = { tablero_resumen: resumen, tablero_sitio: sitio, tablero_seo: seo, tablero_estado: estado };

// T2: pauta e inversión (ejemplo).
function pauta({ p_desde, p_hasta }) {
  const f = dias(p_desde, p_hasta);
  const r = azar('pauta' + p_desde + p_hasta);
  const serie = f.map((fecha) => { const x = azar('m' + fecha)(); return { fecha, inversion: Math.round(38000 + x * 16000), conversaciones: Math.round(4 + x * 5) }; });
  const meta = serie.reduce((a, x) => a + x.inversion, 0);
  const conversaciones = serie.reduce((a, x) => a + x.conversaciones, 0);
  const brevo = Math.round(17 * 4100 / 30 * f.length);
  const mes = p_hasta.slice(0, 7);
  return {
    kpis: { total: meta + brevo, total_ant: Math.round((meta + brevo) * (0.9 + r() * 0.2)), meta, meta_ant: Math.round(meta * 0.95),
      conversaciones, conversaciones_ant: Math.round(conversaciones * 0.9), meta_clics: Math.round(conversaciones * 8.5), meta_clics_ant: 0,
      meta_impresiones: conversaciones * 580, gads: 0, gads_ant: 0, gads_clics: 0, gads_conversiones: 0 },
    serie: serie.map((x) => ({ ...x, inversion: x.inversion + Math.round(17 * 4100 / 30) })),
    por_plataforma: [{ plataforma: 'Meta', inversion: meta }, { plataforma: 'Brevo', inversion: brevo }],
    por_mes: [{ mes, plataforma: 'Meta', inversion: meta }, { mes, plataforma: 'Brevo', inversion: brevo }],
    campanas_meta: [
      { campana: 'AdxMediaLab.com: Mensajería 2', inversion: Math.round(meta * 0.92), clics: Math.round(conversaciones * 7.8), conversaciones: Math.round(conversaciones * 0.92), costo: 7030 },
      { campana: 'AdxMediaLab.com: Mensajería 3', inversion: Math.round(meta * 0.08), clics: Math.round(conversaciones * 0.7), conversaciones: Math.round(conversaciones * 0.08), costo: 6770 },
    ],
    campanas_gads: [],
  };
}
function inversion(p) { const k = pauta(p).kpis; return { total: k.total, total_ant: k.total_ant }; }
demo.tablero_pauta = pauta;
demo.tablero_inversion = inversion;

// T3: email marketing y prospección (ejemplo).
function email({ p_desde, p_hasta }) {
  const f = dias(p_desde, p_hasta);
  const serie = f.map((fecha) => { const x = azar('e' + fecha)(); const env = Math.round(20 + x * 30); return { fecha, enviados: env, aperturas: Math.round(env * (0.3 + x * 0.2)), clics: Math.round(env * 0.04) }; });
  const s = (k) => serie.reduce((a, x) => a + x[k], 0);
  const enviados = s('enviados'), aperturas = s('aperturas'), clics = s('clics'), entregados = Math.round(enviados * 0.98);
  const secs = [['Nutrición - Wip equipos', 0.55], ['Pymes - Info solicitada', 0.3], ['Pymes - Demo solicitada', 0.1], ['Pymes - Demo completada', 0.05]];
  return {
    kpis: { enviados, enviados_ant: Math.round(enviados * 0.9), entregados, entregados_ant: Math.round(entregados * 0.9), aperturas, aperturas_ant: Math.round(aperturas * 0.85),
      clics, clics_ant: Math.round(clics * 1.1), inversion: Math.round(17 * 4100 / 30 * f.length), inversion_ant: Math.round(17 * 4100 / 30 * f.length) },
    serie,
    secuencias: secs.map(([secuencia, p]) => ({ secuencia, enviados: Math.round(enviados * p), entregados: Math.round(entregados * p), aperturas: Math.round(aperturas * p),
      clics: Math.round(clics * p), tasa_apertura: aperturas / entregados, tasa_clics: clics / entregados })),
    correos: secs.map(([secuencia, p], i) => ({ asunto: ['Excel, WhatsApp y llamadas para manejar tus servicios', 'Tus servicios están a punto de cambiar🚀', 'Tu sesión en vivo de WIP está confirmada 📅', 'Lo que siempre nos preguntan en Wip'][i],
      secuencia, enviados: Math.round(enviados * p), aperturas: Math.round(aperturas * p), clics: Math.round(clics * p), tasa_apertura: aperturas / entregados })),
    campanas: [],
    clics_desde_correos: [{ correo: 'info-2', clic_a: 'Agenda', clics: 3, personas: 3 }, { correo: 'nutricion-1', clic_a: 'WhatsApp', clics: 2, personas: 2 }],
    visitas_desde_correos: [{ correo: 'nutricion-wip-equipos-1', visitas: 9, conversiones: 1 }, { correo: 'info-solicitada-3', visitas: 4, conversiones: 0 }],
  };
}
function prospeccion({ p_desde, p_hasta }) {
  const f = dias(p_desde, p_hasta);
  const serie = f.map((fecha) => { const x = azar('x' + fecha)(); return { fecha, enviados: Math.round(80 + x * 60), respuestas: Math.round(x * 2) }; });
  const enviados = serie.reduce((a, x) => a + x.enviados, 0), respuestas = serie.reduce((a, x) => a + x.respuestas, 0);
  const gasto = Math.round(enviados * 0.03 * 4100);
  return {
    kpis: { enviados, enviados_ant: Math.round(enviados * 0.8), respuestas, respuestas_ant: Math.round(respuestas * 0.7), gasto, gasto_ant: Math.round(gasto * 0.8), leads: 4, leads_ant: 3 },
    serie,
    campanas: [
      { campana: 'assistance and services companies', enviados: Math.round(enviados * 0.6), respuestas: Math.round(respuestas * 0.7), leads: 3, tasa_respuesta: 0.011, gasto: Math.round(gasto * 0.6), costo_lead: Math.round(gasto * 0.2) },
      { campana: 'Industrial field contractors', enviados: Math.round(enviados * 0.4), respuestas: Math.round(respuestas * 0.3), leads: 1, tasa_respuesta: 0.008, gasto: Math.round(gasto * 0.4), costo_lead: Math.round(gasto * 0.4) },
    ],
    leads: [{ fecha: p_hasta, campana: 'assistance and services companies', empresa: 'Asistencias del Norte', cargo: 'Gerente de operaciones', pais: 'Colombia',
      nombre: 'Persona de ejemplo', correo: 'ejemplo@empresa.com', telefono: '', linkedin: 'https://www.linkedin.com/in/ejemplo', motivo: 'Nos interesa, ¿podemos agendar una demo la otra semana?' }],
    agenda_por_campana: [{ campana: 'asistencias', clics: 2, personas: 2 }],
    visitas_por_campana: [{ campana: 'asistencias', visitas: 6, conversiones: 1 }, { campana: 'industrial', visitas: 3, conversiones: 0 }],
  };
}
demo.tablero_email = email;
demo.tablero_prospeccion = prospeccion;

// T4: embudo (ejemplo).
function embudo({ p_desde, p_hasta }) {
  const f = dias(p_desde, p_hasta);
  const serie = f.map((fecha) => { const x = azar('k' + fecha)(); return { fecha, nuevas: Math.round(1 + x * 4), agendadas: Math.round(x * 1.6) }; });
  const nuevas = serie.reduce((a, x) => a + x.nuevas, 0), agendadas = serie.reduce((a, x) => a + x.agendadas, 0);
  const inversion = pauta({ p_desde, p_hasta }).kpis.total;
  return {
    kpis: { nuevas, nuevas_ant: Math.round(nuevas * 0.8), agendadas, agendadas_ant: Math.round(agendadas * 0.7), hechas: Math.round(agendadas * 0.7), hechas_ant: 3,
      clientes: 2, clientes_ant: 1, inversion, inversion_ant: Math.round(inversion * 0.9), abiertas: 34 },
    etapas: [['Leads Entrantes', 'entrantes', 6], ['Nuevo', 'abierta', 14], ['Reunión agendada', 'abierta', 5], ['Reunión hecha', 'abierta', 4], ['Decidió tomar WIP', 'abierta', 3],
      ['Factura enviada', 'abierta', 2], ['Cliente activo', 'ganada', 9], ['Perdido', 'perdida', 11]].map(([etapa, tipo, n]) => ({ etapa, tipo, oportunidades: n, valor: n * 450000 })),
    por_origen: [
      { origen: 'Meta Ads', nuevas: Math.round(nuevas * 0.6), agendadas: Math.round(agendadas * 0.5), hechas: 3, clientes: 1, inversion: Math.round(inversion * 0.9), costo_reunion: 180000, costo_cliente: 950000 },
      { origen: 'Sitio web', nuevas: Math.round(nuevas * 0.25), agendadas: Math.round(agendadas * 0.3), hechas: 2, clientes: 1, inversion: 0, costo_reunion: null, costo_cliente: null },
      { origen: 'Explee', nuevas: Math.round(nuevas * 0.15), agendadas: Math.round(agendadas * 0.2), hechas: 1, clientes: 0, inversion: Math.round(inversion * 0.06), costo_reunion: 65000, costo_cliente: null },
    ],
    tiempos: { a_agendada: 2.4, a_hecha: 5.1, a_cliente: 18.6 },
    serie,
    perdidas: [{ motivo: 'Presupuesto insuficiente', oportunidades: 3 }, { motivo: 'Sin motivo', oportunidades: 2 }],
    recientes: [{ fecha: p_hasta, nombre: 'Transportes del Valle', etapa: 'Reunión agendada', origen: 'Meta Ads', campana: '', responsable: 'Misha Forero', valor: 600000 }],
  };
}
demo.tablero_embudo = embudo;

// F7: agente de WhatsApp (ejemplo).
function agente({ p_desde, p_hasta }) {
  const serie = dias(p_desde, p_hasta).map((fecha) => { const x = azar('a' + fecha)(); return { fecha, conversaciones: Math.round(2 + x * 6), respuestas: Math.round(4 + x * 14), seguimientos: Math.round(x * 3) }; });
  const conversaciones = serie.reduce((a, x) => a + x.conversaciones, 0), respuestas = serie.reduce((a, x) => a + x.respuestas, 0);
  const atendidas = Math.round(conversaciones * 0.9);
  return {
    kpis: { atendidas, atendidas_ant: Math.round(atendidas * 0.8), recibidos: respuestas + conversaciones, recibidos_ant: respuestas, respuestas, respuestas_ant: Math.round(respuestas * 0.8),
      traspasos: Math.round(atendidas * 0.15), traspasos_ant: 2, reuniones: Math.round(atendidas * 0.2), reuniones_ant: 3, conversaciones, conversaciones_ant: Math.round(conversaciones * 0.8),
      seguimientos: Math.round(atendidas * 0.4), seguimientos_ant: 4, reactivadas: Math.round(atendidas * 0.12), reactivadas_ant: 1,
      correos: Math.round(atendidas * 0.25), correos_ant: 3, espera_mediana: 32, espera_mediana_ant: 41, sin_respuesta: 1 },
    serie,
    guion: [['El agente respondió', 1], ['La persona siguió la conversación', 0.78], ['Preguntó el tipo de servicio', 0.7], ['Preguntó por la herramienta actual', 0.55],
      ['Preguntó el reto', 0.46], ['Explicó WIP', 0.4], ['Ofreció la demo', 0.31], ['Envió el enlace de agenda', 0.22], ['Dio su correo', 0.25], ['Llegó a reunión', 0.2]]
      .map(([paso, t], i) => ({ orden: i + 1, paso, conversaciones: Math.round(atendidas * t), tasa: atendidas ? Math.round(atendidas * t) / atendidas : null })),
    sin_respuesta: [{ ultimo: p_hasta + 'T16:40:00Z', nombre: 'Refrigeración Caribe', origen: 'Meta Ads', etapa: 'Nuevo', ultimo_mensaje: '¿Cuál sería el costo de la aplicación?', kommo: 'https://wiptool.kommo.com/leads/detail/3' }],
    conversaciones: [
      { lead_id: 1, nombre: 'Grúas del Norte', origen: 'Meta Ads', etapa: 'Reunión agendada', recibidos: 6, respuestas: 5, paso: 'Envió agenda', correo: 'Sí', traspaso: 'No', seguimiento: 'Respondió', ultimo_mensaje: 'Listo, agendé para el jueves', ultimo: p_hasta + 'T15:20:00Z', kommo: 'https://wiptool.kommo.com/leads/detail/1' },
      { lead_id: 2, nombre: 'Asistencias Andinas', origen: 'Instagram', etapa: 'Nuevo', recibidos: 3, respuestas: 2, paso: 'Tipo de servicio', correo: 'No', traspaso: 'Sí', seguimiento: 'No', ultimo_mensaje: 'Prefiero que me llame un asesor', ultimo: p_hasta + 'T11:05:00Z', kommo: 'https://wiptool.kommo.com/leads/detail/2' },
    ],
    por_origen: [{ origen: 'Meta Ads', atendidas: Math.round(atendidas * 0.8), correos: Math.round(atendidas * 0.2), reuniones: Math.round(atendidas * 0.15), traspasos: 2 }, { origen: 'Instagram', atendidas: Math.round(atendidas * 0.2), correos: 1, reuniones: 1, traspasos: 1 }],
  };
}
demo.tablero_agente = agente;

// Operaciones › Servicios (ejemplo): servicios creados en la plataforma por mes y cliente.
function servicios({ p_meses = 12 }) {
  const hoy = hoyBogota();
  const mesHoy = hoy.slice(0, 7) + '-01';
  const mesMenos = (k) => { const d = new Date(mesHoy + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - k); return d.toISOString().slice(0, 10); };
  const CLIENTES = [['Asisya', 900], ['Auxilia', 520], ['Fixit', 310], ['Hisercol', 180], ['Sotrandes', 120], ['Avise Asistencia', 90], ['Ecoguardian', 40]];
  const TIPOS = [['Grúa', 0.38], ['Cerrajería', 0.17], ['Plomería', 0.15], ['Mantenimiento', 0.14], ['Electricista', 0.1], ['Inspección', 0.06]];
  const ESTADOS = [['Finalizado', 0.82], ['Cancelado', 0.09], ['En curso', 0.05], ['Asignado', 0.04]];
  const avance = Number(hoy.slice(8, 10)) / 30;
  const porClienteMes = [];
  for (let k = Math.max(2, p_meses) - 1; k >= 0; k--) {
    const mes = mesMenos(k);
    CLIENTES.forEach(([cliente, base], i) => {
      if (k > 9 - i) return; // los clientes pequeños llegaron después
      const v = Math.round(base * (0.8 + azar(mes + cliente)() * 0.35) * (1 + (12 - k) * 0.02) * (k === 0 ? avance : 1));
      porClienteMes.push({ mes, cliente, servicios: v });
    });
  }
  const sumaMes = (mes) => porClienteMes.filter((x) => x.mes === mes).reduce((a, x) => a + x.servicios, 0);
  const meses = Array.from({ length: Math.max(2, p_meses) }, (_, i) => mesMenos(Math.max(2, p_meses) - 1 - i));
  const serie = meses.map((fecha) => ({ fecha, servicios: sumaMes(fecha), clientes: porClienteMes.filter((x) => x.mes === fecha && x.servicios).length }));
  const periodo = serie.reduce((a, x) => a + x.servicios, 0);
  const esteMes = sumaMes(mesHoy), anterior = sumaMes(mesMenos(1));
  const completos = serie.slice(0, -1);
  const reparte = (lista, total) => lista.map(([n, t]) => [n, Math.round(total * t)]);
  return {
    ultimo_dia: hoy,
    kpis: { este_mes: esteMes, este_mes_ant: Math.round(anterior * avance * 0.95), mes_anterior: anterior, mes_anterior_ant: sumaMes(mesMenos(2)),
      promedio_12: Math.round(completos.slice(-12).reduce((a, x) => a + x.servicios, 0) / 12), clientes_mes: serie.at(-1).clientes, clientes_mes_ant: serie.at(-2).clientes, periodo },
    serie,
    por_cliente: CLIENTES.map(([cliente]) => {
      const f = porClienteMes.filter((x) => x.cliente === cliente);
      const total = f.reduce((a, x) => a + x.servicios, 0);
      return { cliente, este_mes: f.find((x) => x.mes === mesHoy)?.servicios ?? 0, mes_anterior: f.find((x) => x.mes === mesMenos(1))?.servicios ?? 0,
        periodo: total, promedio: Math.round((total - (f.find((x) => x.mes === mesHoy)?.servicios ?? 0)) / completos.length), ultimo: hoy };
    }),
    por_tipo: reparte(TIPOS, periodo).map(([tipo, v]) => ({ tipo, este_mes: Math.round(v * esteMes / periodo), periodo: v })),
    por_estado: reparte(ESTADOS, periodo).map(([estado, v]) => ({ estado, este_mes: Math.round(v * esteMes / periodo), periodo: v })),
    por_cliente_mes: porClienteMes,
  };
}
demo.tablero_servicios = servicios;

// Operaciones › Servicios, vista por días (ejemplo).
function serviciosDias({ p_desde, p_hasta }) {
  const serie = dias(p_desde, p_hasta).map((fecha) => { const x = azar('sd' + fecha)(); const s = Math.round(450 + x * 250); return { fecha, servicios: s, finalizados: Math.round(s * 0.84) }; });
  const total = serie.reduce((a, x) => a + x.servicios, 0), fin = serie.reduce((a, x) => a + x.finalizados, 0);
  const CLIENTES = [['Asisya', 0.2], ['Fixit', 0.17], ['Constructora Bolívar', 0.14], ['Auxilia', 0.1], ['Hisercol', 0.06]];
  return {
    ultimo_dia: hoyBogota(),
    kpis: { servicios: total, servicios_ant: Math.round(total * 0.94), finalizados: fin, finalizados_ant: Math.round(fin * 0.95), cancelados: Math.round(total * 0.06),
      cancelados_ant: Math.round(total * 0.07), clientes: 32, clientes_ant: 35, por_dia: Math.round(total / serie.length), por_dia_ant: Math.round(total * 0.94 / serie.length) },
    serie,
    por_cliente: CLIENTES.map(([cliente, t]) => ({ cliente, servicios: Math.round(total * t), servicios_ant: Math.round(total * t * 0.9), finalizados: Math.round(total * t * 0.85), cancelados: Math.round(total * t * 0.06), tasa_finalizados: 0.85 })),
    por_tipo: [['Grúa', 0.3], ['Diligencia', 0.25], ['Asistencia jurídica', 0.15]].map(([tipo, t]) => ({ tipo, servicios: Math.round(total * t), servicios_ant: Math.round(total * t * 0.9) })),
    por_estado: [['Finalizado', 0.84], ['Cancelado', 0.06], ['Pendiente', 0.06]].map(([estado, t]) => ({ estado, servicios: Math.round(total * t), servicios_ant: Math.round(total * t * 0.95) })),
  };
}
demo.tablero_servicios_dias = serviciosDias;

// Costos de marketing (ejemplo con los valores revisados el 19 de octubre de 2026).
function costos(p) {
  const trm = 3950;
  const s = (id, plataforma, categoria, para_que, monto, moneda, cobro, estado, desde, extra = {}) => ({
    id, plataforma, categoria, para_que, monto, moneda, cobro, estado, desde, hasta: null, nota: '', proximo_pago: null, ultimo_pago: null,
    ultimo_pago_monto: null, ultimo_pago_estado: '', metodo_pago: '', suma_inversion: cobro === 'mensual' && estado !== 'prueba',
    actualizado_por: 'ejemplo', actualizado: '2026-10-19T00:00:00Z', cop_mes: 0, gasto_mes: 0, ...extra,
  });
  const suscripciones = [
    s(1, 'Brevo', 'Herramientas de marketing', 'Correos de nutrición y secuencias', 17, 'USD', 'mensual', 'activo', '2026-07-02',
      { proximo_pago: '2026-11-07', ultimo_pago: '2026-10-07', ultimo_pago_monto: 17, ultimo_pago_estado: 'pagado', nota: 'Plan Starter · 10.000 correos al mes', cop_mes: 41100 }),
    s(2, 'Kommo', 'CRM y WhatsApp', 'CRM y WhatsApp comercial', 45, 'USD', 'mensual', 'prueba', '2026-10-20',
      { proximo_pago: '2026-10-20', nota: 'Prueba de Pro que vence el 20 de octubre.' }),
    s(3, 'n8n', 'Automatización e IA', 'Flujos de Meli y del tablero', 27, 'USD', 'mensual', 'por_confirmar', '2026-10-13', { cop_mes: 24000, nota: 'Confirmar el valor en el portal de n8n.' }),
    s(4, 'Claude API (Meli)', 'Automatización e IA', 'Meli y calificador', 0, 'USD', 'prepago', 'activo', '2026-09-01',
      { gasto_mes: 63900, cop_mes: 63900, ultimo_pago: '2026-10-09', ultimo_pago_monto: 20, ultimo_pago_estado: 'pagado', nota: 'Saldo US$8,83 y recarga automática apagada.' }),
    s(5, 'Explee', 'Prospección', 'Correos en frío', 0, 'USD', 'prepago', 'activo', '2026-09-01', { gasto_mes: 159337, cop_mes: 159337, nota: 'El saldo se agotó el 18 de octubre.' }),
    s(6, 'Apollo.io', 'Prospección', 'Base de contactos', 59, 'USD', 'mensual', 'suspendido', '2026-07-03', { hasta: '2026-09-03', nota: 'Suspendido el 2 de octubre por pagos fallidos.' }),
    s(7, 'WhatsApp Business (plataforma)', 'Operación de la plataforma', 'Notificaciones a clientes finales', 0, 'USD', 'consumo', 'activo', '2026-07-01', { gasto_mes: 58700, suma_inversion: false }),
  ];
  return {
    mes: (p.p_mes || '2026-10-01').slice(0, 8) + '01', corte: '2026-10-19', trm, suscripciones,
    gastos: [
      { id: 1, plataforma: 'Claude API (Meli)', fecha: '2026-10-19', monto: 16.17, moneda: 'USD', concepto: 'Consumo del 1 al 19 de octubre', suma_inversion: true, cop: 63900 },
      { id: 2, plataforma: 'WhatsApp Business (plataforma)', fecha: '2026-10-19', monto: 14.87, moneda: 'USD', concepto: 'Saldo de octubre por cobrar', suma_inversion: false, cop: 58700 },
    ],
    pagos: [
      { id: 1, plataforma: 'Meta Ads', fecha: '2026-10-19', monto: 215208, moneda: 'COP', estado: 'pendiente', referencia: 'Saldo pendiente', nota: 'Límite de gasto alcanzado', cop: 215208 },
      { id: 2, plataforma: 'Meta Ads', fecha: '2026-10-15', monto: 455038, moneda: 'COP', estado: 'pagado', referencia: 'W3X4B86HA4', nota: 'Mastercard •••• 5177', cop: 455038 },
      { id: 3, plataforma: 'Meta Ads', fecha: '2026-10-08', monto: 455038, moneda: 'COP', estado: 'pagado', referencia: 'VDZVU6NGA4', nota: 'Mastercard •••• 5177', cop: 455038 },
      { id: 4, plataforma: 'Claude Pro', fecha: '2026-10-16', monto: 20, moneda: 'USD', estado: 'pagado', referencia: '2984-0977-5007', nota: '', cop: 79000 },
      { id: 5, plataforma: 'Brevo', fecha: '2026-10-07', monto: 17, moneda: 'USD', estado: 'pagado', referencia: 'SIB-6014875', nota: '', cop: 67150 },
    ],
    explee: { usd: 40.3, cop: 159337, enviados: 1340 },
    pauta: { meta: 1492669, gads: 0 },
    por_plataforma: [{ plataforma: 'Meta', cop: 1492669 }, { plataforma: 'Explee', cop: 159337 }, { plataforma: 'Claude API (Meli)', cop: 63900 }, { plataforma: 'Brevo', cop: 41100 }, { plataforma: 'n8n', cop: 24000 }],
    total: 1781006, fuera_marketing: 58700,
  };
}
demo.tablero_costos = costos;

// WIP General (ejemplo con cifras parecidas a las reales de octubre de 2026).
function general() {
  const base = [15841, 16761, 18136, 22982, 18398, 15096, 18198, 14981, 17724, 8463];
  const serie = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(Date.UTC(2024, 10 + i, 1)).toISOString().slice(0, 10);
    const s = i >= 14 ? base[i - 14] : 16000 + Math.round(Math.sin(i) * 2500);
    return { mes: d, servicios: s, activos: 26 + (i % 6), nuevos: i % 3, perdidos: (i + 1) % 3, reactivados: 0 };
  });
  return {
    hoy: '2026-10-19', mes_actual: '2026-10-01', ultimo_mes: '2026-09-01', inicio: '2023-01-01', minimo: 20, margen: 0.8, ultimo_dia: '2026-10-18',
    lista_clientes: ['FIXIT', 'ASISYA', 'Constructora Bolivar'], facturacion: [], serie,
    hero: { ultimo: 17724, anterior: 14981, hace_un_ano: 21107, actual: 8463, proyeccion: 17490, record: 30423, record_mes: '2023-07-01' },
    crecimiento: { mom: 0.183, cmgr3: 0.055, cmgr6: -0.004, cmgr12: -0.014, ttm: 217169, ttm_anterior: 208102, anual: 0.044, cagr: 0.057, cagr_desde: '2023-12-01' },
    clientes: { activos: 31, activos_ant: 26, activos_hace_un_ano: 27, nuevos_3m: 11, perdidos_3m: 6, churn_ultimo: 0.077, churn_3m: 0.08, churn_12m: 0.097 },
    retencion: { nrr: 0.652, grr: 0.399, clientes: 26, siguen: 16, logos: 0.615 },
    quick_ratio: { nuevos: 631, expansion: 7036, contraccion: 4837, perdida: 202, ratio: 1.52 },
    concentracion: { top1: 0.158, top1_cliente: 'FIXIT', top5: 0.558, top: [{ cliente: 'FIXIT', servicios: 9196, pct: 0.158 }, { cliente: 'ASISYA', servicios: 7775, pct: 0.133 }] },
    cohortes: [
      { trimestre: '2026-07-01', clientes: 11, retencion: { 1: 67 } },
      { trimestre: '2026-01-01', clientes: 5, retencion: { 1: 80, 3: 40, 6: 20 } },
      { trimestre: '2025-04-01', clientes: 4, retencion: { 1: 75, 3: 75, 6: 25, 12: 50 } },
      { trimestre: '2024-07-01', clientes: 3, retencion: { 1: 33, 3: 33, 6: 67, 12: 33, 24: 33 } },
    ],
    embudo: { desde: '2026-09-01', etapas: [['Leads nuevos', 453], ['En conversación', 453], ['Reunión agendada', 30], ['Reunión hecha', 18], ['Propuesta enviada', 13], ['Decidió tomar WIP', 5]].map(([etapa, oportunidades]) => ({ etapa, oportunidades })) },
    cac: { inversion_90: 5248239, clientes_90: 5, reuniones_90: 18, nuevos_plataforma_90: 12 },
    ingresos: { meses_cargados: 0, mrr: null, mrr_ant: null, clientes_facturados: 0, nrr: null, serie: [] },
  };
}
demo.tablero_general = general;

// Operaciones › Gastos (ejemplo).
function gastos() {
  const facturas = ['2026-10-02', '2026-09-01', '2026-08-01', '2026-07-01'].map((fecha, i) => ({
    id: 'g' + i, cuenta: i ? 'asisteapp.co' : 'wiptool.com', numero: String(5703667524 - i * 1000), fecha, monto: 73.7, moneda: 'USD', archivo: '', correo_url: '#' }));
  const movimientos = [
    { fecha: '2026-10-01', cuenta: 'asisteapp.co', tipo: 'rechazo', monto: null, moneda: 'USD', detalle: 'Mastercard ••5177', correo_url: '#' },
    { fecha: '2026-09-15', cuenta: 'asisteapp.co', tipo: 'rechazo', monto: null, moneda: 'USD', detalle: 'Mastercard ••5177', correo_url: '#' },
    { fecha: '2026-08-03', cuenta: 'asisteapp.co', tipo: 'pago', monto: 73.7, moneda: 'USD', detalle: '', correo_url: '#' },
  ];
  return { kpis: { facturas: 4, facturado_12m: 294.8, pagado_12m: 221.1, ultimo_pago: '2026-08-03', ultimo_pago_monto: 73.7, rechazos_sin_pago: 2,
    ultimo_rechazo: '2026-10-01', facturas_sin_pago: 2 }, facturas, movimientos };
}
demo.tablero_gastos = gastos;
