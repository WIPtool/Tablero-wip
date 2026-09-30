// Arma los flujos de n8n a partir de los archivos .js de esta carpeta:
//  - f12-carga-tablero.json: cada hora carga Google (Analytics y Search Console), Meta Ads, la TRM, Brevo y Explee a Supabase.
//  - f14-google-ads.json:    recibe lo que envía el script de Google Ads y lo guarda en Supabase.
// Uso: node n8n/armar-flujo.cjs
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
};
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
const codigoTexto = (id, name, posicion, js) => ({ id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: posicion, parameters: { jsCode: js } });
const http = (id, name, posicion, extra) => ({
  id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: posicion,
  parameters: { method: 'GET', url: '={{ $json.url }}', options: lotes, ...extra.parameters },
  ...(extra.credentials ? { credentials: extra.credentials } : {}),
});
const a = (nodo) => ({ main: [[{ node: nodo, type: 'main', index: 0 }]] });
const varios = (...nodos) => ({ main: [nodos.map((node) => ({ node, type: 'main', index: 0 }))] });

const INICIOS = ['Trabajos Google', 'Trabajos Meta', 'Trabajos TRM', 'Trabajos Brevo', 'Trabajos Explee'];
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
    codigo('a1f0c0de-0015-4000-8000-000000000015', 'Filas Brevo', [740, 700], 'filas.js', true, { __TRABAJOS__: 'Trabajos Brevo' }),

    codigoTexto('a1f0c0de-0016-4000-8000-000000000016', 'Trabajos Explee', [260, 900], EXPLEE['Trabajos Explee']),
    http('a1f0c0de-0017-4000-8000-000000000017', 'Campañas Explee', [420, 900], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.explee }),
    codigoTexto('a1f0c0de-0018-4000-8000-000000000018', 'Pedidos Explee', [580, 900], EXPLEE['Pedidos Explee']),
    http('a1f0c0de-0019-4000-8000-000000000019', 'Consultar Explee', [740, 900], {
      parameters: { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' },
      credentials: CRED.explee }),
    codigoTexto('a1f0c0de-0020-4000-8000-000000000020', 'Filas Explee', [900, 900], EXPLEE['Filas Explee']),

    guardar('a1f0c0de-0006-4000-8000-000000000006', [1100, 300]),
  ],
  connections: {
    'Cada hora': varios(...INICIOS),
    'Cargar histórico (a mano)': varios(...INICIOS),
    'Trabajos Google': a('Consultar Google'), 'Consultar Google': a('Filas Google'), 'Filas Google': a('Guardar en Supabase'),
    'Trabajos Meta': a('Consultar Meta'), 'Consultar Meta': a('Filas Meta'), 'Filas Meta': a('Guardar en Supabase'),
    'Trabajos TRM': a('Consultar TRM'), 'Consultar TRM': a('Filas TRM'), 'Filas TRM': a('Guardar en Supabase'),
    'Trabajos Brevo': a('Consultar Brevo'), 'Consultar Brevo': a('Filas Brevo'), 'Filas Brevo': a('Guardar en Supabase'),
    'Trabajos Explee': a('Campañas Explee'), 'Campañas Explee': a('Pedidos Explee'), 'Pedidos Explee': a('Consultar Explee'),
    'Consultar Explee': a('Filas Explee'), 'Filas Explee': a('Guardar en Supabase'),
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

fs.writeFileSync(path.join(__dirname, 'f12-carga-tablero.json'), JSON.stringify(f12, null, 2));
fs.writeFileSync(path.join(__dirname, 'f14-google-ads.json'), JSON.stringify(f14, null, 2));
console.log('ok · webhook de Google Ads: https://wiptool.app.n8n.cloud/webhook/' + RUTA_GADS);
