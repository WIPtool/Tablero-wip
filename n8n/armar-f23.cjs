// Arma n8n/f23-facturas-kommo.json: F23 · Pedidos de Kommo (Gmail → Supabase), para Marketing › Inversión.
// Kommo no da la facturación por API (con el token de larga duración, /orders/<n>/invoice y /settings/pay responden 403):
// el flujo lee en misha@wiptool.com los correos "Tu pedido <n> fue pagado con éxito" de support@kommo.com y guarda una fila
// por pedido en proveedor_factura (proveedor 'kommo'). El correo no trae el monto: la fila se guarda SIN la columna monto
// para no borrar el que se cargue aparte (el del pedido #5064983, US$160, se cargó el 2026-10-29). El tablero enlaza cada
// pedido a su factura en Kommo, que se abre con la sesión de Kommo de quien la pide.
// Corre cada día a las 6:50 a. m. (últimos 60 días); el disparador manual carga todo el histórico.
// Uso: node n8n/armar-f23.cjs   (después se importa en n8n.wiptool.com)
const fs = require('fs');
const path = require('path');

const CRED_GOOGLE = { id: 'jnLeMVYFho7CTP6Q', name: 'Google account' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const CONSULTA = 'from:support@kommo.com subject:"fue pagado"';

const pedidos = String.raw`
const filas = [];
for (const it of $input.all()) {
  const m = it.json;
  const asunto = ((m.payload && m.payload.headers) || []).find((h) => h.name.toLowerCase() === 'subject');
  const n = ((asunto && asunto.value) || '').match(/pedido\s+#?(\d+)/i);
  if (!n) continue;
  filas.push({
    id: 'kommo:' + n[1], proveedor: 'kommo', cuenta: 'wiptool.kommo.com', numero: n[1],
    fecha: new Date(Number(m.internalDate) - 5 * 3600e3).toISOString().slice(0, 10), // hora de Colombia
    moneda: 'USD', estado: 'PAID', periodo: '', archivo: '',
    correo_url: 'https://mail.google.com/mail/u/?authuser=misha@wiptool.com#all/' + m.id,
  });
}
return [{ json: { filas } }];`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const gmail = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api' };
const supa = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const credG = { credentials: { googleOAuth2Api: CRED_GOOGLE } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };
const reintentos = { retryOnFail: true, maxTries: 5, waitBetweenTries: 5000 };

const nodos = [
  { id: 'a1', name: 'Cada día 6:50', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '50 6 * * *' }] } } },
  { id: 'a2', name: 'Cargar histórico (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} },
  { id: 'b1', name: 'Últimos 60 días', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
    parameters: { jsCode: `return [{ json: { q: ${JSON.stringify(CONSULTA + ' newer_than:60d')} } }];` } },
  { id: 'b2', name: 'Todo el histórico', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 200],
    parameters: { jsCode: `return [{ json: { q: ${JSON.stringify(CONSULTA)} } }];` } },
  http('c1', 'Buscar correos', 440, 100, { parameters: { url: GMAIL, ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'q', value: '={{ $json.q }}' }, { name: 'maxResults', value: '500' }] }, options: {} }, ...credG, ...reintentos }),
  { id: 'c2', name: 'Un ítem por correo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 100],
    parameters: { jsCode: 'return $input.all().flatMap((i) => (i.json.messages || []).map((m) => ({ json: { id: m.id } })));' } },
  http('c3', 'Leer asunto', 880, 100, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}', ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'format', value: 'metadata' }, { name: 'metadataHeaders', value: 'Subject' }] },
    options: { batching: { batch: { batchSize: 3, batchInterval: 2000 } } } }, ...credG, ...reintentos }),
  { id: 'c4', name: 'Pedidos', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 100], parameters: { jsCode: pedidos.trim() } },
  http('c5', 'Guardar pedidos', 1320, 100, { parameters: {
    url: SUPABASE + '/rest/v1/proveedor_factura?on_conflict=id', method: 'POST', ...supa,
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}', options: {} }, ...credS }),
  http('c6', 'Marcar carga', 1540, 100, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...supa,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'kommo-facturas', p_filas: $('Pedidos').first().json.filas.length }) }}", options: {} }, ...credS }),
];

const c = (a, b) => ({ [a]: { main: [[{ node: b, type: 'main', index: 0 }]] } });
const connections = {
  ...c('Cada día 6:50', 'Últimos 60 días'),
  ...c('Cargar histórico (a mano)', 'Todo el histórico'),
  ...c('Últimos 60 días', 'Buscar correos'),
  ...c('Todo el histórico', 'Buscar correos'),
  ...c('Buscar correos', 'Un ítem por correo'),
  ...c('Un ítem por correo', 'Leer asunto'),
  ...c('Leer asunto', 'Pedidos'),
  ...c('Pedidos', 'Guardar pedidos'),
  ...c('Guardar pedidos', 'Marcar carga'),
};

const flujo = {
  name: 'F23 · Pedidos de Kommo (Gmail → Supabase)',
  nodes: nodos,
  connections,
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', errorWorkflow: 'EnFP5wE2LSfxcvxi' },
};
fs.writeFileSync(path.join(__dirname, 'f23-facturas-kommo.json'), JSON.stringify(flujo, null, 2));
console.log('ok · n8n/f23-facturas-kommo.json (' + nodos.length + ' nodos)');
