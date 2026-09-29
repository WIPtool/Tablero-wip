// Modo de ejemplo: cifras inventadas con la misma forma que devuelven las funciones de Supabase.
// Se usa mientras no hay base conectada. Son deterministas (la misma fecha da siempre el mismo número)
// para que el periodo anterior y los cambios se vean coherentes.
import { sumarDias, diasEntre, hoyBogota, anterior } from './rango.js';

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
