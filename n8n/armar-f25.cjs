// Arma n8n/f25-recargas-explee.json: F25 · Recargas de Explee (API → Supabase), para Marketing › Inversión.
// Explee cobra por adelantado: se recarga saldo (US$50 por recarga, Stripe, tarjeta ••5177) y cada correo enviado lo
// descuenta. La API pública (credencial "Explee", X-API-Key) da en /autogtm/billing/activity los últimos 50 depósitos de
// saldo; el flujo guarda una fila por recarga pagada (kind 'paid', no los créditos de regalo) en proveedor_factura
// (proveedor 'explee'), con id 'explee:<occurred_at hasta el segundo>'. Solo inserta recargas nuevas (ignore-duplicates):
// las del histórico se cargaron una vez desde la web de Explee con su número de factura de Stripe y el PDF en el bucket
// "facturas" (explee/<número>.pdf), y el flujo no las toca. La API no da el número ni el PDF de las recargas nuevas, ni los
// cobros directos a la tarjeta cuando el saldo se acaba (como el de US$4,98 del 15-sep-2026, cargado a mano).
// Corre cada día a las 7:05 a. m.
// Uso: node n8n/armar-f25.cjs            → n8n/f25-recargas-explee.json (se importa en n8n.wiptool.com)
//      node n8n/armar-f25.cjs <carpeta>   → además, en <carpeta>, un flujo temporal con webhook que recibe
//                                           [{numero, url}] de PDF de Stripe, los baja y los sube al bucket (uso único).
const fs = require('fs');
const path = require('path');

const CRED_EXPLEE = { id: '1K5Hj4X9btSUKWco', name: 'Explee' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const ACTIVIDAD = 'https://api.explee.com/public/api/v1/autogtm/billing/activity';

const recargas = String.raw`
const filas = [];
for (const it of $input.all()) {
  for (const x of (it.json.items || [])) {
    if (x.kind !== 'paid' || !x.occurred_at || !(Number(x.amount_usd) > 0)) continue; // solo dinero pagado, no créditos de regalo
    filas.push({
      id: 'explee:' + String(x.occurred_at).slice(0, 19), proveedor: 'explee', cuenta: 'wiptool.com', numero: '',
      fecha: new Date(Date.parse(x.occurred_at) - 5 * 3600e3).toISOString().slice(0, 10), // hora de Colombia
      monto: Number(x.amount_usd), moneda: 'USD', estado: 'PAID', periodo: '', archivo: '', correo_url: '',
    });
  }
}
return filas.length ? [{ json: { filas } }] : [];`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const credE = { credentials: { httpHeaderAuth: CRED_EXPLEE } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };

const nodos = [
  { id: 'a1', name: 'Cada día 7:05', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '5 7 * * *' }] } } },
  { id: 'a2', name: 'Revisar ahora (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} },
  http('c1', 'Depósitos de saldo', 240, 100, { parameters: { url: ACTIVIDAD, ...auth, options: {} }, ...credE, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  { id: 'c2', name: 'Recargas', type: 'n8n-nodes-base.code', typeVersion: 2, position: [460, 100], parameters: { jsCode: recargas.trim() } },
  // Solo las nuevas: si el id ya existe (histórico con número y PDF), no se toca.
  http('c3', 'Guardar recargas nuevas', 680, 100, { parameters: {
    url: SUPABASE + '/rest/v1/proveedor_factura?on_conflict=id', method: 'POST', ...auth,
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=ignore-duplicates,return=minimal' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}', options: {} }, ...credS }),
  http('c4', 'Marcar carga', 900, 100, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...auth,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'explee-facturas', p_filas: $('Recargas').first().json.filas.length }) }}", options: {} }, ...credS }),
];

const c = (a, b) => ({ [a]: { main: [[{ node: b, type: 'main', index: 0 }]] } });
const cadena = (...n) => Object.assign({}, ...n.slice(1).map((b, i) => c(n[i], b)));
const connections = {
  ...c('Cada día 7:05', 'Depósitos de saldo'),
  ...c('Revisar ahora (a mano)', 'Depósitos de saldo'),
  ...cadena('Depósitos de saldo', 'Recargas', 'Guardar recargas nuevas', 'Marcar carga'),
};

fs.writeFileSync(path.join(__dirname, 'f25-recargas-explee.json'), JSON.stringify({ name: 'F25 · Recargas de Explee (API → Supabase)', nodes: nodos, connections,
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', errorWorkflow: 'EnFP5wE2LSfxcvxi' } }, null, 2));
console.log('ok · n8n/f25-recargas-explee.json (' + nodos.length + ' nodos)');

// Flujo temporal: recibe {facturas: [{numero, url}]} (url = invoice_pdf de Stripe), baja cada PDF y lo sube al bucket.
const carpeta = process.argv[2];
if (carpeta) {
  const ruta = 'explee-pdf-temporal-' + require('crypto').randomBytes(9).toString('hex');
  const prueba = {
    name: 'Temporal · PDF de Explee al bucket (borrar)',
    nodes: [
      { id: 'w1', name: 'Recibir', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: ruta,
        parameters: { httpMethod: 'POST', path: ruta, responseMode: 'lastNode', responseData: 'allEntries', options: { allowedOrigins: '*' } } },
      { id: 'w2', name: 'Una por factura', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
        parameters: { jsCode: "return (($input.first().json.body || {}).facturas || []).filter((f) => /^[\\w-]+$/.test(f.numero) && /^https:\\/\\/pay\\.stripe\\.com\\//.test(f.url)).map((f) => ({ json: { numero: f.numero, url: f.url, archivo: 'explee/' + f.numero + '.pdf' } }));", mode: 'runOnceForAllItems' } },
      http('w3', 'Bajar PDF', 440, 0, { parameters: { url: '={{ $json.url }}', options: { response: { response: { responseFormat: 'file', outputPropertyName: 'pdf' } } } } }),
      http('w4', 'Subir PDF a Supabase', 660, 0, { parameters: { url: "=" + SUPABASE + "/storage/v1/object/facturas/{{ $('Una por factura').item.json.archivo }}",
        method: 'POST', ...auth, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-upsert', value: 'true' }, { name: 'Content-Type', value: 'application/pdf' }] },
        sendBody: true, contentType: 'binaryData', inputDataFieldName: 'pdf', options: {} }, ...credS }),
      { id: 'w5', name: 'Respuesta', type: 'n8n-nodes-base.code', typeVersion: 2, position: [880, 0],
        parameters: { jsCode: "return $input.all().map((x, i) => ({ json: { archivo: $('Una por factura').all()[i].json.archivo, subida: x.json.Key || x.json.key || JSON.stringify(x.json).slice(0, 120) } }));" } },
    ],
    connections: cadena('Recibir', 'Una por factura', 'Bajar PDF', 'Subir PDF a Supabase', 'Respuesta'),
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  };
  fs.writeFileSync(path.join(carpeta, 'f25-temporal.json'), JSON.stringify(prueba, null, 2));
  console.log('ok · temporal en ' + path.join(carpeta, 'f25-temporal.json') + ' · ruta ' + ruta);
}
