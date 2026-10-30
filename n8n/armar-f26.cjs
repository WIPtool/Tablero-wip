// Arma n8n/f26-recibos-n8n.json: F26 · Recibos de n8n Cloud (Gmail → Supabase), para Marketing › Inversión.
// n8n Cloud (plan Starter, 24 € al mes) se cobra por Paddle; cada cobro manda a misha@wiptool.com el correo «Recibo de la
// transacción de su suscripción Cloud Starter» (help@paddle.com) con el número de recibo y la cantidad pagada en el texto.
// El flujo guarda una fila por recibo en proveedor_factura (proveedor 'n8n'); el tablero enlaza cada una a su correo, que
// tiene el botón «Ver recibo» de Paddle. Desde el 2026-10-28 los flujos corren en el n8n propio (n8n.wiptool.com, servidor
// Lightsail que se cobra dentro de la factura de AWS); este flujo sirve para ver si Cloud vuelve a cobrar.
// Corre cada día a las 7:10 a. m. (últimos 60 días); el disparador manual revisa todo el histórico.
// Uso: node n8n/armar-f26.cjs   (después se importa en n8n.wiptool.com)
const fs = require('fs');
const path = require('path');

const CRED_GOOGLE = { id: 'jnLeMVYFho7CTP6Q', name: 'Google account' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const CONSULTA = 'from:paddle.com ("Cloud Starter" OR "n8n") (recibo OR receipt)';

// El resumen del correo (snippet) trae: «Recibo n.º82490224-172319530 Cantidad pagada 24,00 € Fecha del Recibo …».
const recibos = String.raw`
const aNumero = (s) => {
  s = String(s).replace(/[^\d.,]/g, '');
  const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (i >= 0 && s.length - i - 1 === 2) return Number(s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1));
  return Number(s.replace(/[.,]/g, ''));
};
const filas = [];
for (const it of $input.all()) {
  const m = it.json;
  const t = String(m.snippet || '').replace(/&nbsp;| /g, ' ');
  const n = (t.match(/(?:Recibo|Receipt)\s*(?:n\.?\s*º|#|no\.?)?\s*([\d]+-[\d]+)/i) || [])[1];
  if (!n) continue;
  const p = t.match(/(?:Cantidad pagada|Amount paid)\s*:?\s*(?:(€|US\$|\$|USD|EUR)\s?)?([\d.,]+)\s*(€|US\$|\$|USD|EUR)?/i);
  const simbolo = p ? (p[1] || p[3] || '') : '';
  filas.push({
    id: 'n8n:' + n, proveedor: 'n8n', cuenta: 'n8n Cloud Starter', numero: n,
    fecha: new Date(Number(m.internalDate) - 5 * 3600e3).toISOString().slice(0, 10), // hora de Colombia
    monto: p ? aNumero(p[2]) : null, moneda: /€|EUR/i.test(simbolo) ? 'EUR' : 'USD', estado: 'PAID', periodo: '', archivo: '',
    correo_url: 'https://mail.google.com/mail/u/?authuser=misha@wiptool.com#all/' + m.id,
  });
}
return filas.length ? [{ json: { filas } }] : [];`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const gmail = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api' };
const supa = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const credG = { credentials: { googleOAuth2Api: CRED_GOOGLE } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };
const reintentos = { retryOnFail: true, maxTries: 5, waitBetweenTries: 5000 };

const nodos = [
  { id: 'a1', name: 'Cada día 7:10', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '10 7 * * *' }] } } },
  { id: 'a2', name: 'Cargar histórico (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} },
  { id: 'b1', name: 'Últimos 60 días', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
    parameters: { jsCode: `return [{ json: { q: ${JSON.stringify(CONSULTA + ' newer_than:60d')} } }];` } },
  { id: 'b2', name: 'Todo el histórico', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 200],
    parameters: { jsCode: `return [{ json: { q: ${JSON.stringify(CONSULTA)} } }];` } },
  http('c1', 'Buscar correos', 440, 100, { parameters: { url: GMAIL, ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'q', value: '={{ $json.q }}' }, { name: 'maxResults', value: '500' }] }, options: {} }, ...credG, ...reintentos }),
  { id: 'c2', name: 'Un ítem por correo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 100],
    parameters: { jsCode: 'return $input.all().flatMap((i) => (i.json.messages || []).map((m) => ({ json: { id: m.id } })));' } },
  http('c3', 'Leer correo', 880, 100, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}', ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'format', value: 'metadata' }, { name: 'metadataHeaders', value: 'Subject' }] },
    options: { batching: { batch: { batchSize: 3, batchInterval: 2000 } } } }, ...credG, ...reintentos }),
  { id: 'c4', name: 'Recibos', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 100], parameters: { jsCode: recibos.trim() } },
  http('c5', 'Guardar recibos', 1320, 100, { parameters: {
    url: SUPABASE + '/rest/v1/proveedor_factura?on_conflict=id', method: 'POST', ...supa,
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}', options: {} }, ...credS }),
  http('c6', 'Marcar carga', 1540, 100, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...supa,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'n8n-facturas', p_filas: $('Recibos').first().json.filas.length }) }}", options: {} }, ...credS }),
];

const c = (a, b) => ({ [a]: { main: [[{ node: b, type: 'main', index: 0 }]] } });
const cadena = (...n) => Object.assign({}, ...n.slice(1).map((b, i) => c(n[i], b)));
const connections = {
  ...c('Cada día 7:10', 'Últimos 60 días'),
  ...c('Cargar histórico (a mano)', 'Todo el histórico'),
  ...c('Últimos 60 días', 'Buscar correos'),
  ...c('Todo el histórico', 'Buscar correos'),
  ...cadena('Buscar correos', 'Un ítem por correo', 'Leer correo', 'Recibos', 'Guardar recibos', 'Marcar carga'),
};

fs.writeFileSync(path.join(__dirname, 'f26-recibos-n8n.json'), JSON.stringify({ name: 'F26 · Recibos de n8n Cloud (Gmail → Supabase)', nodes: nodos, connections,
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', errorWorkflow: 'EnFP5wE2LSfxcvxi' } }, null, 2));
console.log('ok · n8n/f26-recibos-n8n.json (' + nodos.length + ' nodos)');
