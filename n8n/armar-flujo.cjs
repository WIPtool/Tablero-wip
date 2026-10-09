// Arma los flujos de n8n a partir de los archivos .js de esta carpeta:
//  - f12-carga-tablero.json: cada hora carga Google (Analytics y Search Console), Meta Ads, la TRM, Brevo, Explee y Kommo a Supabase,
//    y pasa a Kommo los leads calientes nuevos de Explee (F4, explee-kommo.js).
//    Si se define CRED_CALENDLY=<id de la credencial>, también pasa a Kommo las citas nuevas de Calendly (F2, sitio-calendly.js).
//    También califica las conversaciones con Claude (calificador.js), retoma y depura el ciclo de vida del lead (ciclo-vida.js) y
//    pasa a "Sin respuesta (retomar)" a quien dejó de responder en "En conversación" (sin-respuesta.js).
//  - f14-google-ads.json:    recibe lo que envía el script de Google Ads y lo guarda en Supabase.
//  - f18-brevo-kommo.json:   recibe el webhook de Brevo (añadido a lista y baja) y marca la secuencia de correos en Kommo (brevo-kommo.js).
//  - f15-formularios-kommo.json: recibe los formularios del sitio (/api/contact) y los crea en Kommo con su Origen (F1).
//  - f16-agente-whatsapp.json: agente de WhatsApp con Claude (F7); lo llama el webhook de Kommo "mensaje entrante".
//    Necesita CRED_CLAUDE=<id de la credencial Anthropic "Claude (agente WhatsApp)">; con ella F12 también lleva el agente de seguimiento.
//  - f19-recordatorio-demo.json: recordatorio de la demo virtual 20 min antes (recordatorio-demo.js); para
//    Google Calendar, CRED_GCAL=<id de la credencial "Google Calendar (lectura)">.
// Uso: AGENTE_EN_VIVO=1 SEGUIMIENTO_EN_VIVO=1 CRED_CALENDLY=0U9bkwTaH0qwcc9h CRED_CLAUDE=lI6pyiToLgn65AwG node n8n/armar-flujo.cjs  (ids de las credenciales "Calendly (lectura)" y "Claude (agente WhatsApp)" en n8n)
// Las credenciales se referencian por id (se crean a mano en n8n; las claves nunca van en este repositorio).
const fs = require('fs');
const path = require('path');
const leer = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');

const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const CRED = {
  google: { googleOAuth2Api: { id: 'T4UYiY0SCMG7Wu4G', name: 'Google account' } },
  supabase: { httpHeaderAuth: { id: 'us3OmK2VUvuuu7t8', name: 'Supabase (tablero)' } },
  meta: { httpHeaderAuth: { id: 'uRqVoTmjjMMQhVze', name: 'Meta Ads (lectura)' } },
  brevo: { httpHeaderAuth: { id: 'eOtWousRPiKJpfVf', name: 'Brevo (lectura)' } },
  explee: { httpHeaderAuth: { id: '1K5Hj4X9btSUKWco', name: 'Explee' } },
  kommo: { httpHeaderAuth: { id: 'wxfP9VZK9UBkShIS', name: 'Kommo (lectura)' } },
};
// Calendly (lectura): token personal en una credencial Header Auth (Authorization: Bearer …); se crea a mano en n8n.
const CRED_CALENDLY = process.env.CRED_CALENDLY ? { httpHeaderAuth: { id: process.env.CRED_CALENDLY, name: 'Calendly (lectura)' } } : null;
// Ruta del webhook que llama /api/contact del sitio (debe coincidir con N8N_LEADS_URL de api/contact.js en landing-wip).
const RUTA_LEADS = 'leads-sitio-4f9b2c7e1a8d43e6b0d5';
// Agente de WhatsApp: ruta del webhook que llama Kommo, credencial de Claude, campo y Salesbot de Kommo.
const RUTA_AGENTE = 'agente-wa-8d2e61c4b7f94a05a3e9';
const CRED_CLAUDE = process.env.CRED_CLAUDE ? { anthropicApi: { id: process.env.CRED_CLAUDE, name: 'Claude (agente WhatsApp)' } } : null;
const CAMPO_RESPUESTA = 493668; // oportunidad: "Respuesta del agente"
const BOT_RESPUESTA = 16206;    // Salesbot "Agente WhatsApp: enviar respuesta" (envía ese campo por WhatsApp)
const BOT_PLANTILLA = 16850;    // Salesbot "Agente WhatsApp: plantilla retomar contacto" (plantilla de WhatsApp 8720, aprobada por Meta)
const BOT_RECORDATORIO = 16852; // Salesbot "Agente WhatsApp: plantilla recordatorio" (plantilla de WhatsApp 8722, aprobada por Meta)
// Recordatorio 20 min antes de la demo (F19): Salesbot con la plantilla 9568 "Recordatorio demo 20 min WIP" (botones Sí, asistiré /
// Necesito reprogramar) y el campo de la oportunidad que llena su variable.
const BOT_DEMO_20 = 18044;    // Salesbot "Agente WhatsApp: recordatorio demo 20 min" (plantilla 9568, aprobada por Meta)
const CAMPO_ENLACE = 546606;    // Kommo · oportunidad: "Enlace de reunión"
// Google Calendar (lectura) para F19: credencial OAuth de n8n (calendar.readonly); sin ella F19 solo mira Calendly.
const CRED_GCAL = process.env.CRED_GCAL ? { googleCalendarOAuth2Api: { id: process.env.CRED_GCAL, name: 'Google Calendar (lectura)' } } : null;
// Modo prueba del agente: responde solo a oportunidades con la etiqueta "Prueba agente". AGENTE_EN_VIVO=1 lo quita.
const MODO_PRUEBA = process.env.AGENTE_EN_VIVO !== '1';
// Seguimiento: sin SEGUIMIENTO_EN_VIVO=1 solo guarda en Supabase los mensajes que propone (borrador), sin enviarlos.
const SEGUIMIENTO_EN_VIVO = process.env.SEGUIMIENTO_EN_VIVO === '1';
// Correo que consigue el agente: lista "Info solicitada" de Brevo (dispara la secuencia) y campos de la oportunidad en Kommo.
const LISTA_INFO = 9;            // Brevo · lista "Info solicitada" (automatización "Pymes - Info solicitada")
const CAMPO_SECUENCIA = 537462;  // Kommo · oportunidad: "Secuencia Brevo" (Info solicitada / Nutrición / Desuscrito)
const ENUM_INFO = 439040;        // "Info solicitada"
const CAMPO_RETO = 537464;       // Kommo · oportunidad: "Reto"
const ENUM_NUTRICION = 439042;   // "Nutrición"
const ENUM_DESUSCRITO = 439044;  // "Desuscrito"
const ENUM_OPT_DESUSCRITO = 361370; // Kommo · contacto: "Suscripción de marketing" = Desuscrito
// Ruta del webhook que llama Brevo (webhook de marketing: añadido a lista y baja) para marcar la secuencia en Kommo (F18).
const RUTA_BREVO = 'brevo-kommo-e916b8396dcee1b7424b';
// Ruta del webhook que llama el script de Google Ads (difícil de adivinar; no da acceso a nada, solo recibe cifras).
const RUTA_GADS = 'gads-7c1e4b9a2f6d48e3a51c';

const lotes = { batching: { batch: { batchSize: 1, batchInterval: 300 } } };
const guardar = (id, posicion) => ({
  id, name: 'Guardar en Supabase', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: posicion,
  parameters: {
    method: 'POST', url: `${SUPABASE}/rest/v1/rpc/cargar`,
    authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}',
    options: { batching: { batch: { batchSize: 1, batchInterval: 100 } } },
  },
  credentials: CRED.supabase,
});
const codigo = (id, name, posicion, archivo, porElemento, reemplazos = {}) => {
  let js = leer(archivo);
  for (const [a, b] of Object.entries(reemplazos)) js = js.split(a).join(b);
  return { id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: posicion,
    parameters: porElemento ? { mode: 'runOnceForEachItem', jsCode: js } : { jsCode: js } };
};
// Partes de explee.js, separadas por la marca "// == Nombre del nodo".
const partes = (archivo) => Object.fromEntries(leer(archivo).split(/^\/\/ == /m).slice(1)
  .map((b) => { const i = b.indexOf('\n'); return [b.slice(0, i).replace(/\s*\(.*$/, '').trim(), b.slice(i + 1).trim() + '\n']; }));
const EXPLEE = partes('explee.js');
const KOMMO = partes('kommo.js');
const F4 = partes('explee-kommo.js');
const COMUN = partes('kommo-crear.js');
const SITIO = partes('sitio-calendly.js');
const AGENTE = partes('agente.js');
const ANUNCIOS = partes('anuncios-meta.js');
const INSTRUCCIONES = leer('agente-instrucciones.md').trim().replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
// Parte común del agente (contexto, enlaces, limpieza de emojis…) que se pega en los nodos con __COMUN__.
const conComun = (js) => js.split('__COMUN__').join(AGENTE['Común del agente'].trim());
const codigoTexto = (id, name, posicion, js) => ({ id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: posicion, parameters: { jsCode: js } });
const http = (id, name, posicion, extra) => ({
  id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: posicion,
  parameters: { method: 'GET', url: '={{ $json.url }}', options: lotes, ...extra.parameters },
  ...(extra.credentials ? { credentials: extra.credentials } : {}),
});
const a = (nodo) => ({ main: [[{ node: nodo, type: 'main', index: 0 }]] });
const varios = (...nodos) => ({ main: [nodos.map((node) => ({ node, type: 'main', index: 0 }))] });

// Cadena común para crear o actualizar en Kommo (kommo-crear.js), después del nodo que normaliza los datos.
// sufijo distingue los nombres cuando hay varias cadenas en el mismo flujo; ids: prefijo + número.
const cadenaKommo = (normal, sufijo, prefijo, x0, y) => {
  const n = (s) => s + sufijo;
  const id = (k) => `${prefijo}${String(k).padStart(2, '0')}-4000-8000-${String(k).padStart(12, '0')}`;
  const reemplazar = (js) => js.split('__NORMAL__').join(normal).split('__CORREO__').join(n('Buscar correo en Kommo'))
    .split('__TELEFONO__').join(n('Buscar teléfono en Kommo')).split('__ARMAR__').join(n('Armar en Kommo'));
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const nodos = [
    http(id(1), n('Buscar correo en Kommo'), [x0, y], { parameters: { url: '={{ $json.url_correo }}', ...auth }, credentials: CRED.kommo }),
    http(id(2), n('Buscar teléfono en Kommo'), [x0 + 160, y], {
      parameters: { url: `={{ $('${normal}').all()[$itemIndex].json.url_telefono }}`, ...auth }, credentials: CRED.kommo }),
    { ...http(id(3), n('Etapas Kommo'), [x0 + 320, y], {
      parameters: { url: `${SUPABASE}/rest/v1/kommo_lead?select=lead_id,etapa_id`, ...auth }, credentials: CRED.supabase }), executeOnce: true, alwaysOutputData: true },
    codigoTexto(id(4), n('Armar en Kommo'), [x0 + 480, y], reemplazar(COMUN['Armar en Kommo'])),
    http(id(5), n('Crear en Kommo'), [x0 + 640, y], {
      parameters: { method: '={{ $json.metodo }}', ...auth, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.cuerpo) }}' },
      credentials: CRED.kommo }),
    codigoTexto(id(6), n('Nota en Kommo (armar)'), [x0 + 800, y], reemplazar(COMUN['Nota en Kommo'])),
    http(id(7), n('Nota en Kommo'), [x0 + 960, y], {
      parameters: { method: 'POST', ...auth, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.cuerpo) }}' },
      credentials: CRED.kommo }),
  ];
  const nombres = nodos.map((x) => x.name);
  const conexiones = Object.fromEntries(nombres.slice(0, -1).map((nm, i) => [nm, a(nombres[i + 1])]));
  conexiones[normal] = a(nombres[0]);
  return { nodos, conexiones, ultimo: nombres[nombres.length - 1] };
};

const INICIOS = ['Trabajos Google', 'Trabajos Meta', 'Trabajos TRM', 'Trabajos Brevo', 'Trabajos Explee', 'Trabajos Kommo'];
// F2 · Calendly → Kommo (se conecta antes de "Trabajos Kommo", para que la carga del tablero de esa hora ya vea las citas)
const F2 = (() => {
  if (!CRED_CALENDLY) return { nodos: [], conexiones: {}, inicio: [] };
  const id = (k) => `a1f0c0de-01${String(k).padStart(2, '0')}-4000-8000-0000000001${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cadena = cadenaKommo('Lead de la cita (Calendly)', ' (Calendly)', 'a1f0c0de-02', 1700, 1300);
  const nodos = [
    codigoTexto(id(1), 'Trabajos Calendly', [260, 1300], "return [{ json: { url: 'https://api.calendly.com/users/me' } }];\n"),
    http(id(2), 'Usuario Calendly', [420, 1300], { parameters: auth, credentials: CRED_CALENDLY }),
    codigoTexto(id(3), 'Pedidos Calendly', [580, 1300], SITIO['Pedidos Calendly']),
    http(id(4), 'Citas Calendly', [740, 1300], { parameters: auth, credentials: CRED_CALENDLY }),
    { ...http(id(5), 'Ya agendadas (Calendly)', [900, 1300], {
      parameters: { url: `${SUPABASE}/rest/v1/calendly_kommo?select=evento`, ...auth }, credentials: CRED.supabase }), executeOnce: true, alwaysOutputData: true },
    codigoTexto(id(6), 'Citas nuevas (Calendly)', [1060, 1300], SITIO['Citas nuevas']),
    http(id(7), 'Invitados Calendly', [1220, 1300], { parameters: auth, credentials: CRED_CALENDLY }),
    codigoTexto(id(8), 'Lead de la cita (Calendly)', [1380, 1300], SITIO['Lead de la cita']),
    ...cadena.nodos,
    codigoTexto(id(9), 'Registro Calendly-Kommo', [2820, 1300], SITIO['Registro Calendly-Kommo']),
    http(id(10), 'Registrar en Supabase (Calendly)', [2980, 1300], {
      parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/calendly_kommo`, ...auth,
        sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}' },
      credentials: CRED.supabase }),
  ];
  const conexiones = {
    'Trabajos Calendly': a('Usuario Calendly'), 'Usuario Calendly': a('Pedidos Calendly'), 'Pedidos Calendly': a('Citas Calendly'),
    'Citas Calendly': a('Ya agendadas (Calendly)'), 'Ya agendadas (Calendly)': a('Citas nuevas (Calendly)'),
    'Citas nuevas (Calendly)': a('Invitados Calendly'), 'Invitados Calendly': a('Lead de la cita (Calendly)'),
    ...cadena.conexiones, [cadena.ultimo]: a('Registro Calendly-Kommo'), 'Registro Calendly-Kommo': a('Registrar en Supabase (Calendly)'),
  };
  return { nodos, conexiones, inicio: ['Trabajos Calendly'] };
})();
// Anuncios activos de Meta con su texto (para el agente de WhatsApp).
const ANUNCIOS_META = {
  nodos: [
    codigoTexto('a1f0c0de-0301-4000-8000-000000000301', 'Trabajos anuncios Meta', [260, 1500], ANUNCIOS['Trabajos anuncios Meta']),
    http('a1f0c0de-0302-4000-8000-000000000302', 'Consultar anuncios Meta', [500, 1500], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' }, credentials: CRED.meta }),
    codigoTexto('a1f0c0de-0303-4000-8000-000000000303', 'Filas anuncios Meta', [740, 1500], ANUNCIOS['Filas anuncios Meta']),
  ],
  conexiones: { 'Trabajos anuncios Meta': a('Consultar anuncios Meta'), 'Consultar anuncios Meta': a('Filas anuncios Meta'), 'Filas anuncios Meta': a('Guardar en Supabase') },
};
// Agente de seguimiento: cada hora (8 a. m. a 8 p. m.) le escribe una vez más a quien dejó de responder al agente de WhatsApp,
// dentro de la ventana de 24 h. Necesita CRED_CLAUDE. Va en F12 para no gastar ejecuciones de n8n en un flujo aparte.
const SEGUIMIENTO = (() => {
  if (!CRED_CLAUDE) return { nodos: [], conexiones: {}, inicio: [] };
  const id = (k) => `a1f0c0de-04${String(k).padStart(2, '0')}-4000-8000-0000000004${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const preparar = (js) => conComun(js).split('__SUPABASE__').join(SUPABASE).split('__INSTRUCCIONES__').join(INSTRUCCIONES)
    .split('__CAMPO_RESPUESTA__').join(String(CAMPO_RESPUESTA)).split('__BOT_RESPUESTA__').join(String(BOT_RESPUESTA))
    .split('__SEGUIMIENTO_EN_VIVO__').join(String(SEGUIMIENTO_EN_VIVO)).split('__BOT_PLANTILLA__').join(String(BOT_PLANTILLA));
  const y = 1700;
  const nodos = [
    codigoTexto(id(1), 'Trabajos seguimiento', [260, y], preparar(AGENTE['Trabajos seguimiento'])),
    http(id(2), 'Pendientes de seguimiento', [420, y], { parameters: auth, credentials: CRED.supabase }),
    codigoTexto(id(3), 'Pedidos Kommo seguimiento', [580, y], preparar(AGENTE['Pedidos Kommo seguimiento'])),
    { ...http(id(4), 'Consultar Kommo (seguimiento)', [740, y], { parameters: auth, credentials: CRED.kommo }), alwaysOutputData: true, onError: 'continueRegularOutput' },
    codigoTexto(id(5), 'Armar seguimientos', [900, y], preparar(AGENTE['Armar seguimientos'])),
    { ...http(id(6), 'Claude (seguimiento)', [1060, y], { parameters: { method: 'POST', url: 'https://api.anthropic.com/v1/messages',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'anthropicApi',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] }, ...cuerpo('$json.pedido') },
      credentials: CRED_CLAUDE }), onError: 'continueRegularOutput' },
    { id: id(7), name: 'Seguimiento de Claude', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1220, y],
      parameters: { mode: 'runOnceForEachItem', jsCode: preparar(AGENTE['Seguimiento de Claude']) } },
    codigoTexto(id(12), 'Decisiones a guardar', [1300, y], 'return $input.all().filter((i) => !i.json.fallo).map((i) => ({ json: i.json }));\n'),
    http(id(8), 'Guardar seguimiento', [1380, y], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes`, ...auth,
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, ...cuerpo('$json.guardar') },
      credentials: CRED.supabase }),
    codigoTexto(id(9), 'Solo los que se envían', [1540, y], "return $('Seguimiento de Claude').all().filter((i) => i.json.enviar).map((i) => ({ json: i.json }));\n"),
    http(id(10), 'Escribir seguimiento en Kommo', [1700, y], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
      ...cuerpo('$json.kommo') }, credentials: CRED.kommo }),
    http(id(11), 'Enviar seguimiento por WhatsApp', [1860, y], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v2/salesbot/run', ...auth,
      ...cuerpo("$('Solo los que se envían').item.json.bot") }, credentials: CRED.kommo }),
  ];
  const nombres = nodos.map((x) => x.name);
  const conexiones = Object.fromEntries(nombres.slice(0, -1).map((nm, i) => [nm, a(nombres[i + 1])]));
  // Segundo seguimiento con plantilla (pasadas las 24 h): una vez, 2 a 5 días después del primer seguimiento sin respuesta.
  const y2 = 1900;
  const plantilla = [
    codigoTexto(id(21), 'Trabajos plantilla', [260, y2], preparar(AGENTE['Trabajos plantilla'])),
    http(id(22), 'Pendientes de plantilla', [420, y2], { parameters: auth, credentials: CRED.supabase }),
    codigoTexto(id(23), 'Pedidos Kommo plantilla', [580, y2], preparar(AGENTE['Pedidos Kommo plantilla'])),
    { ...http(id(24), 'Consultar Kommo (plantilla)', [740, y2], { parameters: auth, credentials: CRED.kommo }), alwaysOutputData: true, onError: 'continueRegularOutput' },
    codigoTexto(id(25), 'Armar plantillas', [900, y2], preparar(AGENTE['Armar plantillas'])),
    http(id(26), 'Guardar plantilla', [1060, y2], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes`, ...auth,
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, ...cuerpo('$json.guardar') },
      credentials: CRED.supabase }),
    http(id(27), 'Enviar plantilla por WhatsApp', [1220, y2], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v2/salesbot/run', ...auth,
      ...cuerpo("$('Armar plantillas').item.json.bot") }, credentials: CRED.kommo }),
  ];
  const nombres2 = plantilla.map((x) => x.name);
  Object.assign(conexiones, Object.fromEntries(nombres2.slice(0, -1).map((nm, i) => [nm, a(nombres2[i + 1])])));
  return { nodos: [...nodos, ...plantilla], conexiones, inicio: ['Trabajos seguimiento', 'Trabajos plantilla'] };
})();
// Recordatorio de reunión con plantilla: sale de "Usuario Calendly" (F2) y envía una vez por cita, el mismo día.
const RECORDATORIO = (() => {
  if (!CRED_CALENDLY) return { nodos: [], conexiones: {} };
  const id = (k) => `a1f0c0de-05${String(k).padStart(2, '0')}-4000-8000-0000000005${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const preparar = (js) => js.split('__BOT_RECORDATORIO__').join(String(BOT_RECORDATORIO));
  const y = 2100;
  const nodos = [
    codigoTexto(id(1), 'Pedidos recordatorio', [580, y], preparar(AGENTE['Pedidos recordatorio'])),
    http(id(2), 'Citas de hoy (recordatorio)', [740, y], { parameters: auth, credentials: CRED_CALENDLY }),
    { ...http(id(3), 'Registro citas (recordatorio)', [900, y], {
      parameters: { url: `${SUPABASE}/rest/v1/calendly_kommo?select=evento,kommo_lead_id&recordatorio=is.null&kommo_lead_id=not.is.null`, ...auth },
      credentials: CRED.supabase }), executeOnce: true, alwaysOutputData: true },
    codigoTexto(id(4), 'Armar recordatorios', [1060, y], preparar(AGENTE['Armar recordatorios'])),
    http(id(5), 'Marcar recordatorio', [1220, y], { parameters: { method: 'PATCH',
      url: `=${SUPABASE}/rest/v1/calendly_kommo?evento=eq.{{ encodeURIComponent($json.evento) }}`, ...auth,
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, ...cuerpo('$json.marcar') },
      credentials: CRED.supabase }),
    http(id(6), 'Guardar recordatorio', [1380, y], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes`, ...auth,
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, ...cuerpo("$('Armar recordatorios').item.json.guardar") },
      credentials: CRED.supabase }),
    http(id(7), 'Enviar recordatorio por WhatsApp', [1540, y], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v2/salesbot/run', ...auth,
      ...cuerpo("$('Armar recordatorios').item.json.bot") }, credentials: CRED.kommo }),
  ];
  const nombres = nodos.map((x) => x.name);
  const conexiones = Object.fromEntries(nombres.slice(0, -1).map((nm, i) => [nm, a(nombres[i + 1])]));
  conexiones['Usuario Calendly'] = varios('Pedidos Calendly', 'Pedidos recordatorio');
  return { nodos, conexiones };
})();
// Sin respuesta: cada hora pasa a "Sin respuesta (retomar)" a quien dejó de responder en "En conversación" (sin-respuesta.js).
const SINRESP = (() => {
  const SR = partes('sin-respuesta.js');
  const id = (k) => `a1f0c0de-06${String(k).padStart(2, '0')}-4000-8000-0000000006${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const y = 2300;
  const nodos = [
    codigoTexto(id(1), 'Trabajos sin respuesta', [260, y], SR['Trabajos sin respuesta']),
    { ...http(id(2), 'Leads en conversación', [420, y], { parameters: auth, credentials: CRED.kommo }), alwaysOutputData: true },
    codigoTexto(id(3), 'Pedidos mensajes sin respuesta', [580, y], SR['Pedidos mensajes sin respuesta']),
    { ...http(id(4), 'Mensajes (sin respuesta)', [740, y], { parameters: auth, credentials: CRED.kommo }), alwaysOutputData: true, onError: 'continueRegularOutput' },
    codigoTexto(id(5), 'Armar sin respuesta', [900, y], SR['Armar sin respuesta']),
    http(id(6), 'Pasar a Sin respuesta', [1060, y], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
      ...cuerpo("$('Armar sin respuesta').first().json.mover") }, credentials: CRED.kommo }),
    http(id(7), 'Nota sin respuesta', [1220, y], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/leads/notes', ...auth,
      ...cuerpo("$('Armar sin respuesta').first().json.notas") }, credentials: CRED.kommo }),
  ];
  const nombres = nodos.map((x) => x.name);
  const conexiones = Object.fromEntries(nombres.slice(0, -1).map((nm, i) => [nm, a(nombres[i + 1])]));
  return { nodos, conexiones, inicio: ['Trabajos sin respuesta'] };
})();
// Ciclo de vida del lead (ciclo-vida.js): Retomador y Depurador, cada hora sobre Sin respuesta, Reunión agendada y Propuesta enviada.
// Salesbots de las plantillas de retome (A propuesta 9748, B inicial 9750, C calificar 9754, D último con servicio 9762, E último general 9764).
const BOTS_RETOME = { A: 18206, B: 18222, C: 18208, D: null, E: null };
const CICLO = (() => {
  const CV = partes('ciclo-vida.js');
  const id = (k) => `a1f0c0de-07${String(k).padStart(2, '0')}-4000-8000-0000000007${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const preparar = (js) => js.split('__SUPABASE__').join(SUPABASE).split('__BOTS_RETOME__').join(JSON.stringify(BOTS_RETOME));
  const ciclo = "$('Armar ciclo').first().json";
  const sigue = { onError: 'continueRegularOutput', alwaysOutputData: true };
  const y = 2500;
  const nodos = [
    codigoTexto(id(1), 'Trabajos ciclo', [260, y], CV['Trabajos ciclo']),
    { ...http(id(2), 'Leads del ciclo', [420, y], { parameters: auth, credentials: CRED.kommo }), ...sigue },
    codigoTexto(id(3), 'Pedidos Kommo ciclo', [580, y], CV['Pedidos Kommo ciclo']),
    { ...http(id(4), 'Datos Kommo (ciclo)', [740, y], { parameters: auth, credentials: CRED.kommo }), ...sigue },
    codigoTexto(id(5), 'Pedidos Supabase ciclo', [900, y], preparar(CV['Pedidos Supabase ciclo'])),
    { ...http(id(6), 'Datos Supabase (ciclo)', [1060, y], { parameters: auth, credentials: CRED.supabase }), ...sigue },
    codigoTexto(id(7), 'Armar ciclo', [1220, y], preparar(CV['Armar ciclo'])),
    { ...http(id(8), 'Cambios en Kommo (ciclo)', [1380, y], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
      ...cuerpo(`${ciclo}.leads`) }, credentials: CRED.kommo }), ...sigue },
    { ...http(id(9), 'Notas (ciclo)', [1540, y], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/leads/notes', ...auth,
      ...cuerpo(`${ciclo}.notas`) }, credentials: CRED.kommo }), ...sigue },
    { ...http(id(10), 'Tareas (ciclo)', [1700, y], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/tasks', ...auth,
      ...cuerpo(`${ciclo}.tareas`) }, credentials: CRED.kommo }), ...sigue },
    { ...http(id(11), 'Retomes por WhatsApp (ciclo)', [1860, y], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v2/salesbot/run', ...auth,
      ...cuerpo(`${ciclo}.bots`) }, credentials: CRED.kommo }), ...sigue },
    { ...http(id(12), 'Registrar retomes (ciclo)', [2020, y], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes`, ...auth,
      sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, ...cuerpo(`${ciclo}.filas`) },
      credentials: CRED.supabase }), ...sigue },
    codigoTexto(id(13), 'Contactos Brevo (ciclo)', [2180, y], CV['Contactos Brevo']),
    { ...http(id(14), 'Nutrición Brevo (ciclo)', [2340, y], { parameters: { method: 'POST', url: 'https://api.brevo.com/v3/contacts', ...auth,
      ...cuerpo('$json') }, credentials: CRED.brevo }), onError: 'continueRegularOutput' },
  ];
  const nombres = nodos.map((x) => x.name);
  const conexiones = Object.fromEntries(nombres.slice(0, -1).map((nm, i) => [nm, a(nombres[i + 1])]));
  return { nodos, conexiones, inicio: ['Trabajos ciclo'] };
})();
// Calificador (calificador.js): Claude lee las conversaciones con mensajes nuevos y llena la calificación en Kommo.
const CALIFICADOR = (() => {
  if (!CRED_CLAUDE) return { nodos: [], conexiones: {}, inicio: [] };
  const CA = partes('calificador.js');
  const id = (k) => `a1f0c0de-08${String(k).padStart(2, '0')}-4000-8000-0000000008${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const preparar = (js) => js.split('__SUPABASE__').join(SUPABASE);
  const y = 2700;
  const nodos = [
    codigoTexto(id(1), 'Trabajos calificador', [260, y], preparar(CA['Trabajos calificador'])),
    http(id(2), 'Mensajes recientes (calificador)', [420, y], { parameters: auth, credentials: CRED.supabase }),
    codigoTexto(id(3), 'Pedidos calificador', [580, y], CA['Pedidos calificador']),
    { ...http(id(4), 'Leads a calificar', [740, y], { parameters: auth, credentials: CRED.kommo }), alwaysOutputData: true, onError: 'continueRegularOutput' },
    { ...codigoTexto(id(5), 'Elegir a calificar', [900, y], preparar(CA['Elegir a calificar'])), onError: 'continueRegularOutput' },
    http(id(6), 'Historial (calificador)', [1060, y], { parameters: { ...auth, options: { ...lotes, response: { response: { responseFormat: 'text' } } } },
      credentials: CRED.supabase }),
    { ...codigoTexto(id(7), 'Pedido a Claude (calificador)', [1220, y], CA['Pedido a Claude']), onError: 'continueRegularOutput' },
    { ...http(id(8), 'Claude (calificador)', [1380, y], { parameters: { method: 'POST', url: 'https://api.anthropic.com/v1/messages',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'anthropicApi',
      sendHeaders: true, headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] }, ...cuerpo('$json.pedido') },
      credentials: CRED_CLAUDE }), onError: 'continueRegularOutput' },
    { ...codigoTexto(id(9), 'Calificación en Kommo', [1540, y], CA['Calificación en Kommo']), onError: 'continueRegularOutput' },
    { ...http(id(10), 'Guardar calificación', [1700, y], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
      ...cuerpo('$json.cuerpo') }, credentials: CRED.kommo }), onError: 'continueRegularOutput' },
  ];
  const nombres = nodos.map((x) => x.name);
  const conexiones = Object.fromEntries(nombres.slice(0, -1).map((nm, i) => [nm, a(nombres[i + 1])]));
  return { nodos, conexiones, inicio: ['Trabajos calificador'] };
})();
const ARRANQUE = [...INICIOS.slice(0, -1), 'Trabajos anuncios Meta', ...F2.inicio, INICIOS[INICIOS.length - 1], ...SEGUIMIENTO.inicio, ...SINRESP.inicio, ...CALIFICADOR.inicio, ...CICLO.inicio];
const f12 = {
  name: 'F12 · Carga del tablero (Google, Meta y TRM → Supabase)',
  nodes: [
    { id: 'a1f0c0de-0001-4000-8000-000000000001', name: 'Cada hora', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
      position: [0, 200], parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 10 }] } } },
    { id: 'a1f0c0de-0002-4000-8000-000000000002', name: 'Cargar histórico (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1,
      position: [0, 400], parameters: {} },

    codigo('a1f0c0de-0003-4000-8000-000000000003', 'Trabajos Google', [260, 100], 'trabajos.js', false),
    http('a1f0c0de-0004-4000-8000-000000000004', 'Consultar Google', [500, 100], {
      parameters: { method: 'POST', authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}' },
      credentials: CRED.google }),
    codigo('a1f0c0de-0005-4000-8000-000000000005', 'Filas Google', [740, 100], 'filas.js', true, { __TRABAJOS__: 'Trabajos Google' }),

    codigo('a1f0c0de-0007-4000-8000-000000000007', 'Trabajos Meta', [260, 300], 'trabajos-meta.js', false),
    http('a1f0c0de-0008-4000-8000-000000000008', 'Consultar Meta', [500, 300], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.meta }),
    codigo('a1f0c0de-0009-4000-8000-000000000009', 'Filas Meta', [740, 300], 'filas.js', true, { __TRABAJOS__: 'Trabajos Meta' }),

    codigo('a1f0c0de-0010-4000-8000-000000000010', 'Trabajos TRM', [260, 500], 'trabajos-trm.js', false),
    http('a1f0c0de-0011-4000-8000-000000000011', 'Consultar TRM', [500, 500], { parameters: {} }),
    codigo('a1f0c0de-0012-4000-8000-000000000012', 'Filas TRM', [740, 500], 'filas-trm.js', false),

    codigo('a1f0c0de-0013-4000-8000-000000000013', 'Trabajos Brevo', [260, 700], 'trabajos-brevo.js', false),
    http('a1f0c0de-0014-4000-8000-000000000014', 'Consultar Brevo', [500, 700], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.brevo }),
    codigo('a1f0c0de-0015-4000-8000-000000000015', 'Filas Brevo', [740, 700], 'filas-brevo.js', false),

    codigoTexto('a1f0c0de-0016-4000-8000-000000000016', 'Trabajos Explee', [260, 900], EXPLEE['Trabajos Explee']),
    http('a1f0c0de-0017-4000-8000-000000000017', 'Campañas Explee', [420, 900], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.explee }),
    codigoTexto('a1f0c0de-0018-4000-8000-000000000018', 'Pedidos Explee', [580, 900], EXPLEE['Pedidos Explee']),
    http('a1f0c0de-0019-4000-8000-000000000019', 'Consultar Explee', [740, 900], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.explee }),
    codigoTexto('a1f0c0de-0020-4000-8000-000000000020', 'Filas Explee', [900, 900], EXPLEE['Filas Explee']),

    codigoTexto('a1f0c0de-0021-4000-8000-000000000021', 'Trabajos Kommo', [260, 1100], KOMMO['Trabajos Kommo']),
    http('a1f0c0de-0022-4000-8000-000000000022', 'Consultar Kommo', [500, 1100], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.kommo }),
    codigoTexto('a1f0c0de-0023-4000-8000-000000000023', 'Filas Kommo', [740, 1100], KOMMO['Filas Kommo']),
    // Origen automático: llena el campo Origen vacío con el utm_source del chat o, si el primer mensaje fue ilegible (error 131060), Meta Ads.
    { ...http('a1f0c0de-0034-4000-8000-000000000034', 'Mensajes ilegibles', [740, 1200], {
      parameters: { url: `${SUPABASE}/rest/v1/agente_mensajes?select=lead_id&rol=eq.cliente&or=${encodeURIComponent('(texto.ilike.*Mensaje ilegible*,texto.ilike.*No se puede mostrar este mensaje*,texto.ilike.*Unable to display this message*)')}`,
        authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' }, credentials: CRED.supabase }), executeOnce: true, alwaysOutputData: true },
    codigoTexto('a1f0c0de-0035-4000-8000-000000000035', 'Origen por marcar', [900, 1200], KOMMO['Origen por marcar']),
    http('a1f0c0de-0036-4000-8000-000000000036', 'Marcar origen en Kommo', [1060, 1200], {
      parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.cuerpo) }}' }, credentials: CRED.kommo }),

    // F4 · Explee → Kommo (sale de "Filas Explee")
    { ...http('a1f0c0de-0024-4000-8000-000000000024', 'Pendientes para Kommo', [1060, 1000], {
      parameters: { url: `${SUPABASE}/rest/v1/explee_pendientes_kommo?select=*`, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.supabase }), executeOnce: true, alwaysOutputData: true },
    codigoTexto('a1f0c0de-0025-4000-8000-000000000025', 'Nuevos para Kommo', [1220, 1000], F4['Nuevos para Kommo']),
    http('a1f0c0de-0026-4000-8000-000000000026', 'Buscar correo en Kommo', [1380, 1000], {
      parameters: { url: '={{ $json.url_correo }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.kommo }),
    http('a1f0c0de-0027-4000-8000-000000000027', 'Buscar teléfono en Kommo', [1540, 1000], {
      parameters: { url: "={{ $('Nuevos para Kommo').all()[$itemIndex].json.url_telefono }}", authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.kommo }),
    codigoTexto('a1f0c0de-0028-4000-8000-000000000028', 'Armar oportunidades', [1700, 1000], F4['Armar oportunidades']),
    http('a1f0c0de-0029-4000-8000-000000000029', 'Crear en Kommo', [1860, 1000], {
      parameters: { method: '={{ $json.metodo }}', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.cuerpo) }}' },
      credentials: CRED.kommo }),
    codigoTexto('a1f0c0de-0030-4000-8000-000000000030', 'Nota de cada uno', [2020, 1000], F4['Nota de cada uno']),
    http('a1f0c0de-0031-4000-8000-000000000031', 'Nota en Kommo', [2180, 1000], {
      parameters: { method: 'POST', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.cuerpo) }}' },
      credentials: CRED.kommo }),
    codigoTexto('a1f0c0de-0032-4000-8000-000000000032', 'Registro Explee-Kommo', [2340, 1000], F4['Registro Explee-Kommo']),
    http('a1f0c0de-0033-4000-8000-000000000033', 'Registrar en Supabase', [2500, 1000], {
      parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/explee_kommo`, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}' },
      credentials: CRED.supabase }),

    guardar('a1f0c0de-0006-4000-8000-000000000006', [1100, 300]),
    ...F2.nodos,
    ...ANUNCIOS_META.nodos,
    ...SEGUIMIENTO.nodos,
    ...RECORDATORIO.nodos,
    ...SINRESP.nodos,
    ...CALIFICADOR.nodos,
    ...CICLO.nodos,
  ],
  connections: {
    'Cada hora': varios(...ARRANQUE),
    'Cargar histórico (a mano)': varios(...ARRANQUE),
    ...F2.conexiones,
    ...ANUNCIOS_META.conexiones,
    ...SEGUIMIENTO.conexiones,
    ...RECORDATORIO.conexiones,
    ...SINRESP.conexiones,
    ...CALIFICADOR.conexiones,
    ...CICLO.conexiones,
    'Trabajos Google': a('Consultar Google'), 'Consultar Google': a('Filas Google'), 'Filas Google': a('Guardar en Supabase'),
    'Trabajos Meta': a('Consultar Meta'), 'Consultar Meta': a('Filas Meta'), 'Filas Meta': a('Guardar en Supabase'),
    'Trabajos TRM': a('Consultar TRM'), 'Consultar TRM': a('Filas TRM'), 'Filas TRM': a('Guardar en Supabase'),
    'Trabajos Brevo': a('Consultar Brevo'), 'Consultar Brevo': a('Filas Brevo'), 'Filas Brevo': a('Guardar en Supabase'),
    'Trabajos Explee': a('Campañas Explee'), 'Campañas Explee': a('Pedidos Explee'), 'Pedidos Explee': a('Consultar Explee'),
    'Consultar Explee': a('Filas Explee'), 'Filas Explee': varios('Guardar en Supabase', 'Pendientes para Kommo'),
    'Pendientes para Kommo': a('Nuevos para Kommo'), 'Nuevos para Kommo': a('Buscar correo en Kommo'), 'Buscar correo en Kommo': a('Buscar teléfono en Kommo'),
    'Buscar teléfono en Kommo': a('Armar oportunidades'), 'Armar oportunidades': a('Crear en Kommo'), 'Crear en Kommo': a('Nota de cada uno'),
    'Nota de cada uno': a('Nota en Kommo'), 'Nota en Kommo': a('Registro Explee-Kommo'), 'Registro Explee-Kommo': a('Registrar en Supabase'),
    'Trabajos Kommo': a('Consultar Kommo'), 'Consultar Kommo': varios('Filas Kommo', 'Mensajes ilegibles'), 'Filas Kommo': a('Guardar en Supabase'),
    'Mensajes ilegibles': a('Origen por marcar'), 'Origen por marcar': a('Marcar origen en Kommo'),
  },
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', saveDataSuccessExecution: 'none' },
  pinData: {},
};

const f14 = {
  name: 'F14 · Google Ads → Supabase (lo llama el script de Google Ads)',
  nodes: [
    { id: 'b2e0c0de-0001-4000-8000-000000000001', name: 'Recibir de Google Ads', type: 'n8n-nodes-base.webhook', typeVersion: 2,
      position: [0, 0], webhookId: 'b2e0c0de-0001-4000-8000-00000000c0de',
      parameters: { httpMethod: 'POST', path: RUTA_GADS, responseMode: 'onReceived', options: {} } },
    codigo('b2e0c0de-0002-4000-8000-000000000002', 'Filas Google Ads', [240, 0], 'filas-gads.js', false),
    guardar('b2e0c0de-0003-4000-8000-000000000003', [480, 0]),
  ],
  connections: { 'Recibir de Google Ads': a('Filas Google Ads'), 'Filas Google Ads': a('Guardar en Supabase') },
  settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  pinData: {},
};

// F1 · Formularios del sitio → Kommo
const F1 = cadenaKommo('Lead del formulario', '', 'c3f0c0de-01', 480, 0);
const f15 = {
  name: 'F15 · Formularios del sitio → Kommo (lo llama /api/contact)',
  nodes: [
    { id: 'c3f0c0de-0001-4000-8000-000000000001', name: 'Recibir formulario', type: 'n8n-nodes-base.webhook', typeVersion: 2,
      position: [0, 0], webhookId: 'c3f0c0de-0001-4000-8000-0000000c0de1',
      parameters: { httpMethod: 'POST', path: RUTA_LEADS, responseMode: 'onReceived', options: {} } },
    codigoTexto('c3f0c0de-0002-4000-8000-000000000002', 'Lead del formulario', [240, 0], SITIO['Lead del formulario']),
    ...F1.nodos,
  ],
  connections: { 'Recibir formulario': a('Lead del formulario'), ...F1.conexiones },
  settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  pinData: {},
};

fs.writeFileSync(path.join(__dirname, 'f12-carga-tablero.json'), JSON.stringify(f12, null, 2));
fs.writeFileSync(path.join(__dirname, 'f15-formularios-kommo.json'), JSON.stringify(f15, null, 2));

// F7 · Agente de WhatsApp con Claude
if (CRED_CLAUDE) {
  const id = (k) => `d4f0c0de-00${String(k).padStart(2, '0')}-4000-8000-0000000000${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpoJson = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const supabaseInsert = (prefer) => ({ sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: prefer }] } });
  const respuesta = "$('Respuesta de Claude').first().json";
  const f16 = {
    name: 'F16 · Agente de WhatsApp con Claude (lo llama Kommo)',
    nodes: [
      { id: id(1), name: 'Mensaje de Kommo', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
        webhookId: 'd4f0c0de-0001-4000-8000-0000000c0de7', parameters: { httpMethod: 'POST', path: RUTA_AGENTE, responseMode: 'onReceived', options: {} } },
      codigoTexto(id(2), 'Mensaje entrante', [200, 0], AGENTE['Mensaje entrante']),
      http(id(3), 'Guardar mensaje', [400, 0], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes?on_conflict=mensaje_id`, ...auth,
        ...supabaseInsert('resolution=ignore-duplicates,return=minimal'),
        ...cuerpoJson('{ lead_id: $json.lead_id, rol: "cliente", texto: $json.texto, mensaje_id: $json.mensaje_id, talk_id: $json.talk_id, momento: $json.momento }') },
        credentials: CRED.supabase }),
      { id: id(4), name: 'Esperar', type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [600, 0], webhookId: 'd4f0c0de-0004-4000-8000-0000000c0de8',
        parameters: { amount: 20, unit: 'seconds' } },
      { ...http(id(5), 'Historial', [800, 0], { parameters: {
        url: `=${SUPABASE}/rest/v1/agente_mensajes?select=rol,texto,mensaje_id,momento,tipo&tipo=neq.sin_seguimiento&lead_id=eq.{{ $('Mensaje entrante').first().json.lead_id }}&order=momento.desc&limit=40`, ...auth },
        credentials: CRED.supabase }), alwaysOutputData: true },
      { ...http(id(6), 'Lead en Kommo', [1000, 0], { parameters: {
        url: "=https://wiptool.kommo.com/api/v4/leads/{{ $('Mensaje entrante').first().json.lead_id }}?with=contacts", ...auth }, credentials: CRED.kommo }), executeOnce: true },
      codigoTexto(id(17), 'Anuncio a buscar', [1100, 160], AGENTE['Anuncio a buscar'].split('__SUPABASE__').join(SUPABASE)),
      { ...http(id(18), 'Anuncio de Meta', [1150, 0], { parameters: { ...auth }, credentials: CRED.supabase }), alwaysOutputData: true },
      // Mensajes que salieron por WhatsApp a este contacto en 24 h: si son más que las respuestas del agente, escribió alguien del equipo.
      { ...http(id(19), 'Mensajes enviados', [1175, 160], { parameters: { url: "={{ $('Anuncio a buscar').first().json.url_enviados }}", ...auth }, credentials: CRED.kommo }),
        executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' },
      codigoTexto(id(7), 'Decidir y preguntar a Claude', [1200, 0], conComun(AGENTE['Decidir y preguntar a Claude']).split('__INSTRUCCIONES__').join(INSTRUCCIONES).split('__MODO_PRUEBA__').join(String(MODO_PRUEBA))),
      http(id(8), 'Claude', [1400, 0], { parameters: { method: 'POST', url: 'https://api.anthropic.com/v1/messages',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'anthropicApi',
        sendHeaders: true, headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }] }, ...cuerpoJson('$json.pedido') },
        credentials: CRED_CLAUDE }),
      codigoTexto(id(9), 'Respuesta de Claude', [1600, 0], conComun(AGENTE['Respuesta de Claude'])
        .split('__CAMPO_RESPUESTA__').join(String(CAMPO_RESPUESTA)).split('__BOT_RESPUESTA__').join(String(BOT_RESPUESTA))
        .split('__LISTA_INFO__').join(String(LISTA_INFO)).split('__CAMPO_SECUENCIA__').join(String(CAMPO_SECUENCIA))
        .split('__ENUM_INFO__').join(String(ENUM_INFO)).split('__CAMPO_RETO__').join(String(CAMPO_RETO))),
      http(id(10), 'Escribir respuesta en Kommo', [1800, 0], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
        ...cuerpoJson('$json.kommo') }, credentials: CRED.kommo }),
      http(id(11), 'Enviar por WhatsApp', [2000, 0], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v2/salesbot/run', ...auth,
        ...cuerpoJson(`${respuesta}.bot`) }, credentials: CRED.kommo }),
      http(id(12), 'Guardar respuesta', [2200, 0], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes`, ...auth,
        ...supabaseInsert('return=minimal'), ...cuerpoJson(`${respuesta}.guardar`) }, credentials: CRED.supabase }),
      codigoTexto(id(13), 'Solo si pasa a persona', [2400, 0], `return ${respuesta}.traspaso ? [{ json: {} }] : [];\n`),
      http(id(14), 'Tarea en Kommo', [2600, 0], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/tasks', ...auth,
        ...cuerpoJson(`${respuesta}.tarea`) }, credentials: CRED.kommo }),
      http(id(15), 'Nota de traspaso', [2800, 0], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/leads/notes', ...auth,
        ...cuerpoJson(`${respuesta}.nota`) }, credentials: CRED.kommo }),
      { ...http(id(16), 'Correo de traspaso', [3000, 0], { parameters: { method: 'POST', url: 'https://api.brevo.com/v3/smtp/email', ...auth,
        ...cuerpoJson(`${respuesta}.correo`) }, credentials: CRED.brevo }), onError: 'continueRegularOutput' },
      // Saca la oportunidad de Leads entrantes (o de Sin respuesta) a En conversación cuando la persona escribe.
      codigoTexto(id(29), 'Mover a En conversación', [1100, -400], AGENTE['Mover a En conversación']),
      http(id(30), 'Etapa En conversación', [1300, -400], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
        ...cuerpoJson("$('Mover a En conversación').first().json.cambio") }, credentials: CRED.kommo }),
      // Botón "Necesito reprogramar" del recordatorio de la demo (F19): tarea, nota y correo, en cualquier etapa.
      codigoTexto(id(25), 'Pide reprogramar', [1100, -200], AGENTE['Pide reprogramar'].split('const lead = leerKommo').join(
        AGENTE['Común del agente'].split('\n').find((l) => l.startsWith('const leerKommo')) + '\nconst lead = leerKommo')),
      http(id(26), 'Tarea reprogramar', [1300, -200], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/tasks', ...auth,
        ...cuerpoJson("$('Pide reprogramar').first().json.tarea") }, credentials: CRED.kommo }),
      http(id(27), 'Nota reprogramar', [1500, -200], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/leads/notes', ...auth,
        ...cuerpoJson("$('Pide reprogramar').first().json.nota") }, credentials: CRED.kommo }),
      { ...http(id(28), 'Correo reprogramar', [1700, -200], { parameters: { method: 'POST', url: 'https://api.brevo.com/v3/smtp/email', ...auth,
        ...cuerpoJson("$('Pide reprogramar').first().json.correo") }, credentials: CRED.brevo }), onError: 'continueRegularOutput' },
      // Si la persona dio su correo: entra a la secuencia de Brevo y queda marcado en Kommo.
      codigoTexto(id(20), 'Solo si dio correo', [2400, 200], `return ${respuesta}.brevo ? [{ json: {} }] : [];
`),
      http(id(21), 'Contacto en Brevo', [2600, 200], { parameters: { method: 'POST', url: 'https://api.brevo.com/v3/contacts', ...auth,
        ...cuerpoJson(`${respuesta}.brevo.contacto`) }, credentials: CRED.brevo }),
      http(id(22), 'Secuencia en Kommo', [2800, 200], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
        ...cuerpoJson(`${respuesta}.brevo.lead`) }, credentials: CRED.kommo }),
      { ...http(id(23), 'Correo en el contacto', [3000, 200], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/contacts', ...auth,
        ...cuerpoJson(`${respuesta}.brevo.contacto_kommo`) }, credentials: CRED.kommo }), onError: 'continueRegularOutput' },
      http(id(24), 'Nota de la secuencia', [3200, 200], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/leads/notes', ...auth,
        ...cuerpoJson(`${respuesta}.brevo.nota`) }, credentials: CRED.kommo }),
    ],
    connections: {
      'Mensaje de Kommo': a('Mensaje entrante'), 'Mensaje entrante': a('Guardar mensaje'), 'Guardar mensaje': a('Esperar'), Esperar: a('Historial'),
      Historial: a('Lead en Kommo'), 'Lead en Kommo': varios('Anuncio a buscar', 'Pide reprogramar', 'Mover a En conversación'),
      'Mover a En conversación': a('Etapa En conversación'),
      'Pide reprogramar': a('Tarea reprogramar'), 'Tarea reprogramar': a('Nota reprogramar'), 'Nota reprogramar': a('Correo reprogramar'), 'Anuncio a buscar': a('Anuncio de Meta'), 'Anuncio de Meta': a('Mensajes enviados'), 'Mensajes enviados': a('Decidir y preguntar a Claude'), 'Decidir y preguntar a Claude': a('Claude'),
      Claude: a('Respuesta de Claude'), 'Respuesta de Claude': a('Escribir respuesta en Kommo'), 'Escribir respuesta en Kommo': a('Enviar por WhatsApp'),
      'Enviar por WhatsApp': a('Guardar respuesta'),
      'Guardar respuesta': { main: [[{ node: 'Solo si pasa a persona', type: 'main', index: 0 }, { node: 'Solo si dio correo', type: 'main', index: 0 }]] },
      'Solo si dio correo': a('Contacto en Brevo'), 'Contacto en Brevo': a('Secuencia en Kommo'), 'Secuencia en Kommo': a('Correo en el contacto'),
      'Correo en el contacto': a('Nota de la secuencia'), 'Solo si pasa a persona': a('Tarea en Kommo'),
      'Tarea en Kommo': a('Nota de traspaso'), 'Nota de traspaso': a('Correo de traspaso'),
    },
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
    pinData: {},
  };
  fs.writeFileSync(path.join(__dirname, 'f16-agente-whatsapp.json'), JSON.stringify(f16, null, 2));
}
// F18 · Brevo → Kommo: secuencia de correos de cada persona (campo Secuencia Brevo de la oportunidad).
{
  const BK = partes('brevo-kommo.js');
  const id = (k) => `e5f0c0de-00${String(k).padStart(2, '0')}-4000-8000-0000000000${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const cambios = "$('Armar cambios en Kommo').first().json";
  const f18 = {
    name: 'F18 · Brevo → Kommo: secuencia de correos (lo llama el webhook de Brevo)',
    nodes: [
      { id: id(1), name: 'Aviso de Brevo', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0],
        webhookId: 'e5f0c0de-0001-4000-8000-0000000c0de9', parameters: { httpMethod: 'POST', path: RUTA_BREVO, responseMode: 'onReceived', options: {} } },
      codigoTexto(id(2), 'Evento de Brevo', [220, 0], BK['Evento de Brevo']),
      { ...http(id(3), 'Contacto en Kommo', [440, 0], { parameters: { ...auth }, credentials: CRED.kommo }), alwaysOutputData: true },
      codigoTexto(id(4), 'Armar cambios en Kommo', [660, 0], BK['Armar cambios en Kommo']
        .split('__CAMPO_SECUENCIA__').join(String(CAMPO_SECUENCIA)).split('__ENUM_INFO__').join(String(ENUM_INFO))
        .split('__ENUM_NUTRICION__').join(String(ENUM_NUTRICION)).split('__ENUM_DESUSCRITO__').join(String(ENUM_DESUSCRITO))
        .split('__ENUM_OPT_DESUSCRITO__').join(String(ENUM_OPT_DESUSCRITO))),
      http(id(5), 'Secuencia en Kommo', [880, 0], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
        ...cuerpo(`${cambios}.lead`) }, credentials: CRED.kommo }),
      { ...http(id(6), 'Baja en el contacto', [1100, 0], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/contacts', ...auth,
        ...cuerpo(`${cambios}.contacto`) }, credentials: CRED.kommo }), onError: 'continueRegularOutput' },
      http(id(7), 'Nota en Kommo', [1320, 0], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v4/leads/notes', ...auth,
        ...cuerpo(`${cambios}.nota`) }, credentials: CRED.kommo }),
    ],
    connections: { 'Aviso de Brevo': a('Evento de Brevo'), 'Evento de Brevo': a('Contacto en Kommo'), 'Contacto en Kommo': a('Armar cambios en Kommo'),
      'Armar cambios en Kommo': a('Secuencia en Kommo'), 'Secuencia en Kommo': a('Baja en el contacto'), 'Baja en el contacto': a('Nota en Kommo') },
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
    pinData: {},
  };
  fs.writeFileSync(path.join(__dirname, 'f18-brevo-kommo.json'), JSON.stringify(f18, null, 2));
}
// F19 · Recordatorio de la demo virtual 20 minutos antes (Calendly y, con CRED_GCAL, Google Calendar), con confirmación de asistencia.
if (CRED_CALENDLY && BOT_DEMO_20) {
  const RD = partes('recordatorio-demo.js');
  const id = (k) => `f6f0c0de-00${String(k).padStart(2, '0')}-4000-8000-0000000000${String(k).padStart(2, '0')}`;
  const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
  const cuerpo = (expr) => ({ sendBody: true, specifyBody: 'json', jsonBody: `={{ JSON.stringify(${expr}) }}` });
  const preparar = (js) => js.split('__SUPABASE__').join(SUPABASE).split('__BOT_DEMO_20__').join(String(BOT_DEMO_20))
    .split('__CAMPO_ENLACE__').join(String(CAMPO_ENLACE));
  const google = CRED_GCAL ? [
    { ...http(id(6), 'Eventos Google Calendar', [1100, 0], { parameters: { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleCalendarOAuth2Api',
      url: "=https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=50&timeMin={{ encodeURIComponent($('Ventana de la demo').first().json.desde) }}&timeMax={{ encodeURIComponent($('Ventana de la demo').first().json.hasta) }}" },
      credentials: CRED_GCAL }), executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput' },
    codigoTexto(id(7), 'Invitados a buscar', [1320, 0], RD['Invitados a buscar']),
    { ...http(id(8), 'Contacto en Kommo (demo)', [1540, 0], { parameters: auth, credentials: CRED.kommo }), alwaysOutputData: true, onError: 'continueRegularOutput' },
  ] : [];
  const x = CRED_GCAL ? 1760 : 1100;
  const f19 = {
    name: 'F19 · Recordatorio de demo 20 min antes (Calendly y Google Calendar → WhatsApp)',
    nodes: [
      { id: id(1), name: 'Cada hora (6 a 18 h)', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
        parameters: { rule: { interval: [{ field: 'cronExpression', expression: '10 6-18 * * *' }] } } },
      http(id(2), 'Usuario Calendly', [220, 0], { parameters: { url: 'https://api.calendly.com/users/me', ...auth }, credentials: CRED_CALENDLY }),
      codigoTexto(id(3), 'Ventana de la demo', [440, 0], RD['Ventana de la demo']),
      { ...http(id(4), 'Citas Calendly', [660, 0], { parameters: auth, credentials: CRED_CALENDLY }), alwaysOutputData: true },
      codigoTexto(id(5), 'Pedido registro', [770, 160], preparar(RD['Pedido registro'])),
      { ...http(id(9), 'Registro citas (demo)', [880, 0], { parameters: auth, credentials: CRED.supabase }), executeOnce: true, alwaysOutputData: true },
      ...google,
      codigoTexto(id(10), 'Armar recordatorios 20 min', [x, 0], preparar(RD['Armar recordatorios 20 min'])),
      { id: id(11), name: 'Una por una', type: 'n8n-nodes-base.splitInBatches', typeVersion: 3, position: [x + 220, 0], parameters: { options: {} } },
      { id: id(12), name: 'Esperar a 20 min antes', type: 'n8n-nodes-base.wait', typeVersion: 1.1, position: [x + 440, 120], webhookId: 'f6f0c0de-0012-4000-8000-0000000c0de9',
        parameters: { resume: 'specificTime', dateTime: '={{ $json.envio }}' } },
      http(id(13), 'Enlace en la oportunidad', [x + 660, 120], { parameters: { method: 'PATCH', url: 'https://wiptool.kommo.com/api/v4/leads', ...auth,
        ...cuerpo("$('Una por una').item.json.lead") }, credentials: CRED.kommo }),
      http(id(14), 'Guardar recordatorio', [x + 880, 120], { parameters: { method: 'POST', url: `${SUPABASE}/rest/v1/agente_mensajes`, ...auth,
        sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'return=minimal' }] }, ...cuerpo("$('Una por una').item.json.guardar") },
        credentials: CRED.supabase }),
      http(id(15), 'Enviar por WhatsApp', [x + 1100, 120], { parameters: { method: 'POST', url: 'https://wiptool.kommo.com/api/v2/salesbot/run', ...auth,
        ...cuerpo("$('Una por una').item.json.bot") }, credentials: CRED.kommo }),
    ],
    connections: {
      'Cada hora (6 a 18 h)': a('Usuario Calendly'), 'Usuario Calendly': a('Ventana de la demo'), 'Ventana de la demo': a('Citas Calendly'),
      'Citas Calendly': a('Pedido registro'), 'Pedido registro': a('Registro citas (demo)'),
      'Registro citas (demo)': a(CRED_GCAL ? 'Eventos Google Calendar' : 'Armar recordatorios 20 min'),
      ...(CRED_GCAL ? { 'Eventos Google Calendar': a('Invitados a buscar'), 'Invitados a buscar': a('Contacto en Kommo (demo)'),
        'Contacto en Kommo (demo)': a('Armar recordatorios 20 min') } : {}),
      'Armar recordatorios 20 min': a('Una por una'),
      'Una por una': { main: [[], [{ node: 'Esperar a 20 min antes', type: 'main', index: 0 }]] },
      'Esperar a 20 min antes': a('Enlace en la oportunidad'), 'Enlace en la oportunidad': a('Guardar recordatorio'),
      'Guardar recordatorio': a('Enviar por WhatsApp'), 'Enviar por WhatsApp': a('Una por una'),
    },
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
    pinData: {},
  };
  fs.writeFileSync(path.join(__dirname, 'f19-recordatorio-demo.json'), JSON.stringify(f19, null, 2));
}
fs.writeFileSync(path.join(__dirname, 'f14-google-ads.json'), JSON.stringify(f14, null, 2));
console.log('ok · webhook de Google Ads: https://wiptool.app.n8n.cloud/webhook/' + RUTA_GADS);
console.log('ok · webhook de Brevo (F18): https://wiptool.app.n8n.cloud/webhook/' + RUTA_BREVO);
