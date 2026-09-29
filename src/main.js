import './estilos.css';
import { supabase, modoEjemplo, pedir, limpiarCache } from './datos.js';
import { PRESETS, calcular, anterior, describir, leerGuardado, guardar } from './rango.js';
import { esc, haceCuanto } from './formato.js';
import resumen from './paginas/resumen.js';
import sitio from './paginas/sitio.js';
import { seoSitio, seoPlataforma } from './paginas/seo.js';
import { proximas } from './paginas/pronto.js';

const PAGINAS = [resumen, sitio, seoSitio, seoPlataforma, ...proximas];
const FUENTES = { ga4: 'Google Analytics', gsc: 'Search Console', meta: 'Meta Ads', gads: 'Google Ads', brevo: 'Brevo', explee: 'Explee', kommo: 'Kommo' };
const app = document.getElementById('app');

let periodo = leerGuardado();
let usuario = null;
let turno = 0; // cada cambio de página o periodo invalida las respuestas que lleguen tarde

// ---------------------------------------------------------------------------
// Acceso
// ---------------------------------------------------------------------------
function pantallaAcceso(mensaje = '') {
  app.innerHTML = `<main class="acceso"><div class="caja">
    <img src="/img/logo-lima.png" alt="WIP" width="94" height="40">
    <h1>Tablero de marketing</h1>
    <p>Entra con tu cuenta de Google de WIP (@wiptool.com).</p>
    ${mensaje ? `<div class="error-acceso">${esc(mensaje)}</div>` : ''}
    <button class="boton" id="entrar" type="button">Entrar con Google</button>
  </div></main>`;
  document.getElementById('entrar').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.origin + location.pathname, queryParams: { hd: 'wiptool.com', prompt: 'select_account' } },
    });
    if (error) pantallaAcceso('No se pudo abrir el acceso con Google: ' + error.message);
  });
}

// Si Google o Supabase rechazan el acceso, vuelven con el error en la dirección: se muestra y se limpia.
function errorDeAcceso() {
  const p = new URLSearchParams(location.search + '&' + location.hash.replace(/^#/, ''));
  const msg = p.get('error_description') || p.get('error');
  if (msg) history.replaceState(null, '', location.pathname);
  return msg ? `No se pudo entrar: ${msg.replace(/\+/g, ' ')}. Si sigue pasando, avisa a quien administra el tablero.` : '';
}

async function iniciar() {
  if (modoEjemplo) { usuario = { email: 'modo de ejemplo' }; return armar(); }
  const error = errorDeAcceso();
  if (error) return pantallaAcceso(error);
  const { data } = await supabase.auth.getSession();
  await decidir(data.session);
  supabase.auth.onAuthStateChange((evento, sesion) => {
    if (evento === 'SIGNED_OUT') { usuario = null; pantallaAcceso(); }
    else if (evento === 'SIGNED_IN' && !usuario) decidir(sesion);
  });
}

async function decidir(sesion) {
  if (!sesion) return pantallaAcceso();
  const email = (sesion.user?.email || '').toLowerCase();
  if (!email.endsWith('@wiptool.com')) {
    await supabase.auth.signOut();
    return pantallaAcceso(`La cuenta ${email} no es de WIP. Entra con tu correo @wiptool.com.`);
  }
  usuario = { email };
  armar();
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------
function armar() {
  const enlaces = (lista) => lista.map((p) => `<a href="#/${p.id}" data-id="${p.id}"${p.pronto ? ' class="pronto"' : ''}>` +
    `<span>${esc(p.titulo)}</span>${p.pronto ? `<span class="etapa">${esc(p.etapa)}</span>` : ''}</a>`).join('');
  app.innerHTML = `<div class="marco">
    <aside class="lateral">
      <a class="logo" href="#/resumen" aria-label="Tablero WIP, inicio"><img src="/img/logo-lima.png" alt="WIP" width="61" height="26"><span>Tablero</span></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="cajon">Menú</button>
      <div class="cajon" id="cajon">
        <nav class="nav" aria-label="Páginas del tablero">
          ${enlaces(PAGINAS.filter((p) => !p.pronto))}
          <div class="nav-grupo">Próximas etapas</div>
          ${enlaces(PAGINAS.filter((p) => p.pronto))}
        </nav>
        <div class="pie">
          <div id="estado-datos"></div>
          <span class="usuario" title="${esc(usuario.email)}">${esc(usuario.email)}</span>
          <button type="button" id="tema">Cambiar tema</button>
          ${modoEjemplo ? '' : '<button type="button" id="salir">Salir</button>'}
        </div>
      </div>
    </aside>
    <main class="principal">
      ${modoEjemplo ? `<div class="aviso ejemplo"><div><strong>Modo de ejemplo.</strong> Aún no hay base de datos conectada:
        las cifras son inventadas para ver el diseño. Cuando n8n cargue los datos, aquí aparecerán los reales.</div></div>` : ''}
      <div class="encabezado">
        <div class="titulo"><h1 id="titulo"></h1><span class="sub" id="subtitulo"></span></div>
        <div class="periodo" id="periodo"></div>
      </div>
      <div id="contenido"></div>
    </main>
  </div>`;

  const lateral = app.querySelector('.lateral');
  const menu = app.querySelector('.menu-btn');
  menu.addEventListener('click', () => {
    const abierto = lateral.classList.toggle('abierto');
    menu.setAttribute('aria-expanded', abierto);
  });
  app.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => {
    lateral.classList.remove('abierto'); menu.setAttribute('aria-expanded', 'false');
  }));
  app.querySelector('#tema').addEventListener('click', () => {
    const raiz = document.documentElement;
    const oscuro = raiz.dataset.theme ? raiz.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    raiz.dataset.theme = oscuro ? 'light' : 'dark';
    try { localStorage.setItem('tablero_tema', raiz.dataset.theme); } catch (e) { /* sin almacenamiento */ }
    mostrar(); // las gráficas toman los colores del tema al dibujarse
  });
  app.querySelector('#salir')?.addEventListener('click', () => supabase.auth.signOut());

  pintarPeriodo();
  estadoDatos();
  mostrar();
}

// ---------------------------------------------------------------------------
// Periodo
// ---------------------------------------------------------------------------
function rangoActual() { return calcular(periodo.preset, periodo.desde, periodo.hasta); }

function pintarPeriodo() {
  const r = rangoActual();
  const ant = anterior(r);
  const caja = document.getElementById('periodo');
  caja.innerHTML = `<div class="segmentos" role="group" aria-label="Periodo">
      ${PRESETS.map((p) => `<button type="button" data-p="${p.id}" aria-pressed="${p.id === periodo.preset}">${p.etiqueta}</button>`).join('')}
    </div>
    ${periodo.preset === 'otro' ? `<div class="fechas">
      <label class="sr" for="desde">Desde</label><input type="date" id="desde" value="${r.desde}">
      <span aria-hidden="true">–</span>
      <label class="sr" for="hasta">Hasta</label><input type="date" id="hasta" value="${r.hasta}"></div>` : ''}
    <span class="comparacion">${esc(describir(r))} · comparado con ${esc(describir(ant))}</span>`;
  caja.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    periodo = { ...periodo, preset: b.dataset.p };
    if (b.dataset.p === 'otro' && !periodo.desde) Object.assign(periodo, rangoActual());
    guardar(periodo); pintarPeriodo(); mostrar();
  }));
  caja.querySelectorAll('input[type=date]').forEach((i) => i.addEventListener('change', () => {
    const desde = document.getElementById('desde').value, hasta = document.getElementById('hasta').value;
    if (desde && hasta && desde <= hasta) { periodo = { preset: 'otro', desde, hasta }; guardar(periodo); pintarPeriodo(); mostrar(); }
  }));
}

// ---------------------------------------------------------------------------
// Estado de las cargas (pie de la barra lateral)
// ---------------------------------------------------------------------------
async function estadoDatos() {
  const caja = document.getElementById('estado-datos');
  if (!caja) return;
  try {
    const cargas = await pedir('tablero_estado');
    if (!cargas.length) { caja.innerHTML = '<span class="estado viejo">Aún no hay cargas de datos</span>'; return; }
    caja.innerHTML = cargas.map((c) => {
      const horas = (Date.now() - new Date(c.actualizado).getTime()) / 3600000;
      const limite = c.fuente === 'gsc' || c.fuente === 'gads' ? 30 : 3;
      const clase = c.estado === 'error' ? 'error' : horas > limite ? 'viejo' : '';
      const titulo = c.estado === 'error' ? `Error en la última carga: ${c.mensaje}` : `${c.filas} filas en la última carga`;
      return `<div class="estado ${clase}" title="${esc(titulo)}">${esc(FUENTES[c.fuente] || c.fuente)} · ${esc(haceCuanto(c.actualizado))}</div>`;
    }).join('');
  } catch (e) {
    caja.innerHTML = '<span class="estado error">No se pudo leer el estado</span>';
  }
}

// ---------------------------------------------------------------------------
// Navegación
// ---------------------------------------------------------------------------
function mostrar() {
  const id = (location.hash.replace(/^#\/?/, '') || 'resumen').split('?')[0];
  const pagina = PAGINAS.find((p) => p.id === id) || resumen;
  document.title = `${pagina.titulo} · Tablero WIP`;
  document.getElementById('titulo').textContent = pagina.titulo;
  document.getElementById('subtitulo').textContent = pagina.sub;
  document.getElementById('periodo').hidden = !!pagina.pronto;
  app.querySelectorAll('.nav a').forEach((a) => (a.dataset.id === pagina.id ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const mio = ++turno;
  pagina.render(document.getElementById('contenido'), rangoActual(), () => mio === turno);
}

window.addEventListener('hashchange', () => { if (usuario) { mostrar(); window.scrollTo(0, 0); } });
// Los datos se recargan cada hora; cada 10 minutos se descarta lo guardado en memoria.
setInterval(() => { limpiarCache(); if (usuario) estadoDatos(); }, 10 * 60 * 1000);

iniciar();
