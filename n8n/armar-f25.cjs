// Arma n8n/f25-recargas-explee.json: F25 · Recargas de Explee (recibos de Stripe + API → Supabase), para Marketing › Inversión.
// Explee cobra por adelantado: se recarga saldo (US$50 por recarga, Stripe, tarjeta ••5177) y cada correo enviado lo
// descuenta; si el saldo se acaba, cobra directo a la tarjeta (como los US$4,98 del 15-sep-2026). Dos fuentes, en este orden:
//  1. Recibos de Stripe «Receipt from Explee LTD» que llegan a misha@wiptool.com (desde el 2026-10-29 el correo de
//     facturación del cliente en Stripe es misha@; antes llegaban a jessica@). Traen la factura (Invoice-<número>.pdf), que
//     se guarda en el bucket "facturas" (explee/<número>.pdf). Cada recibo se une a la fila que ya exista con ese número, o
//     a la recarga sin número del mismo día (±1) y monto que haya cargado la API; si no hay, crea 'explee:<número>'.
//     Así entran también los cobros directos a la tarjeta, que la API no muestra.
//  2. API pública (credencial "Explee", X-API-Key), /autogtm/billing/activity: últimos 50 depósitos de saldo. Cada recarga
//     pagada (kind 'paid', no los créditos de regalo) que no esté ya (por id 'explee:<occurred_at hasta el segundo>' o
//     porque su recibo ya la creó con número, mismo día ±1 y monto) se inserta sin número ni PDF.
// El histórico (5 facturas, sep–oct 2026) se cargó una vez desde la web de Explee con número y PDF.
// Corre cada día a las 7:05 a. m. (recibos de los últimos 60 días); el disparador manual revisa todos los recibos.
// Uso: node n8n/armar-f25.cjs            → n8n/f25-recargas-explee.json (se importa en n8n.wiptool.com)
//      node n8n/armar-f25.cjs <carpeta>   → además, en <carpeta>, un flujo temporal con webhook que recibe
//                                           [{numero, url}] de PDF de Stripe, los baja y los sube al bucket (uso único).
const fs = require('fs');
const path = require('path');

const CRED_EXPLEE = { id: '1K5Hj4X9btSUKWco', name: 'Explee' };
const CRED_GOOGLE = { id: 'jnLeMVYFho7CTP6Q', name: 'Google account' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const ACTIVIDAD = 'https://api.explee.com/public/api/v1/autogtm/billing/activity';
const RECIBOS = '"Explee LTD" (receipt OR recibo OR invoice OR factura) has:attachment';
const FILAS = SUPABASE + '/rest/v1/proveedor_factura?proveedor=eq.explee&select=id,numero,fecha,monto';

const comunes = String.raw`
const dias = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
const esDeApi = (id) => /^explee:\d{4}-\d{2}-\d{2}T/.test(id); // id de una recarga cargada por la API
const existentes = (nodo) => $(nodo).all().map((i) => i.json).filter((r) => r && r.id);`;

// Un ítem por recibo de Stripe de Explee, con el número de factura (del nombre del PDF), el monto pagado y la fecha.
const recibo = String.raw`
const texto = (p, tipo = 'text/plain') => {
  if (!p) return '';
  if (p.mimeType === tipo && p.body && p.body.data) return Buffer.from(p.body.data, 'base64').toString('utf8');
  for (const h of p.parts || []) { const t = texto(h, tipo); if (t) return t; }
  return '';
};
const pdfs = (p, out = []) => {
  if (!p) return out;
  if (p.filename && /\.pdf$/i.test(p.filename) && p.body && p.body.attachmentId) out.push({ nombre: p.filename, adjunto: p.body.attachmentId });
  for (const h of p.parts || []) pdfs(h, out);
  return out;
};
const aNumero = (s) => {
  s = String(s).replace(/[^\d.,]/g, '');
  const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (i >= 0 && s.length - i - 1 === 2) return Number(s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1));
  return Number(s.replace(/[.,]/g, ''));
};
const salida = [];
for (const it of $input.all()) {
  const m = it.json;
  const asunto = ((m.payload.headers || []).find((h) => h.name.toLowerCase() === 'subject') || {}).value || '';
  const t = (texto(m.payload) || texto(m.payload, 'text/html').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  if (!/Explee/i.test(asunto + ' ' + t) || /refund|reembolso/i.test(asunto)) continue; // solo cobros de Explee
  const pdf = pdfs(m.payload).find((a) => /^(invoice|factura)/i.test(a.nombre));
  const n = ((pdf && pdf.nombre.match(/^(?:Invoice|Factura)-(.+)\.pdf$/i)) || [])[1];
  if (!n) continue;
  // «Amount paid $50.00» (inglés) o «Importe pagado 50,00 US$» (español)
  const p = t.match(/(?:Amount paid|Importe pagado|Cantidad pagada|Monto pagado)\s*(?:US\$|\$)?\s?([\d.,]+)/i) || t.match(/\bTotal\s*(?:US\$|\$)\s?([\d.,]+)/i);
  salida.push({ json: { id: m.id, adjunto: pdf.adjunto, nombre: pdf.nombre, numero: n, monto: p ? aNumero(p[1]) : null,
    fecha: new Date(Number(m.internalDate) - 5 * 3600e3).toISOString().slice(0, 10), // hora de Colombia
    archivo: 'explee/' + n + '.pdf', correo_url: 'https://mail.google.com/mail/u/?authuser=misha@wiptool.com#all/' + m.id } });
}
return salida;`;

const pdfArchivo = String.raw`
const f = $('Recibo de Explee').item.json;
const b64 = String($json.data || '').replace(/-/g, '+').replace(/_/g, '/');
return { json: f, binary: { pdf: { data: b64, mimeType: 'application/pdf', fileName: f.nombre, fileExtension: 'pdf' } } };`;

// Une cada recibo con la fila que ya exista (mismo número, o recarga de la API sin número del mismo día y monto).
const unir = comunes + String.raw`
const filasHoy = existentes('Filas existentes');
const usados = new Set();
const filas = [];
for (const it of $('Recibo de Explee').all()) {
  const r = it.json;
  const fila = filasHoy.find((e) => e.numero === r.numero)
    || filasHoy.find((e) => !e.numero && esDeApi(e.id) && !usados.has(e.id) && dias(e.fecha, r.fecha) <= 1 && Number(e.monto) === Number(r.monto));
  const id = fila ? fila.id : 'explee:' + r.numero;
  usados.add(id);
  filas.push({ id, proveedor: 'explee', cuenta: 'wiptool.com', numero: r.numero, fecha: fila ? fila.fecha : r.fecha,
    monto: r.monto != null ? r.monto : (fila ? Number(fila.monto) : null), moneda: 'USD', estado: 'PAID', periodo: '',
    archivo: r.archivo, correo_url: r.correo_url });
}
return filas.length ? [{ json: { filas } }] : [];`;

// Recargas de la API que no estén ya (por id, o porque su recibo ya creó la fila con número).
const recargas = comunes + String.raw`
const filasHoy = existentes('Filas actuales');
const ids = new Set(filasHoy.map((e) => e.id));
const usados = new Set();
const filas = [];
for (const x of ($('Depósitos de saldo').first().json.items || [])) {
  if (x.kind !== 'paid' || !x.occurred_at || !(Number(x.amount_usd) > 0)) continue; // solo dinero pagado, no créditos de regalo
  const id = 'explee:' + String(x.occurred_at).slice(0, 19);
  if (ids.has(id)) continue;
  const fecha = new Date(Date.parse(x.occurred_at) - 5 * 3600e3).toISOString().slice(0, 10); // hora de Colombia
  const monto = Number(x.amount_usd);
  const conRecibo = filasHoy.find((e) => e.numero && !esDeApi(e.id) && !usados.has(e.id) && dias(e.fecha, fecha) <= 1 && Number(e.monto) === monto);
  if (conRecibo) { usados.add(conRecibo.id); continue; }
  filas.push({ id, proveedor: 'explee', cuenta: 'wiptool.com', numero: '', fecha, monto, moneda: 'USD', estado: 'PAID', periodo: '', archivo: '', correo_url: '' });
}
return filas.length ? [{ json: { filas } }] : [];`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const auth = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const gmail = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api' };
const credE = { credentials: { httpHeaderAuth: CRED_EXPLEE } };
const credG = { credentials: { googleOAuth2Api: CRED_GOOGLE } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };
const lotes = { batching: { batch: { batchSize: 3, batchInterval: 2000 } } };
const reintentos = { retryOnFail: true, maxTries: 5, waitBetweenTries: 5000 };
const guardar = (prefer) => ({ url: SUPABASE + '/rest/v1/proveedor_factura?on_conflict=id', method: 'POST', ...auth,
  sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: prefer + ',return=minimal' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}', options: {} });
const code = (id, name, x, y, js, extra = {}) => ({ id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y], parameters: { jsCode: js.trim(), ...extra } });

// n8n (orden v1) corre primero la rama de arriba (recibos) y después la de abajo (API).
const nodos = [
  { id: 'a1', name: 'Cada día 7:05', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '5 7 * * *' }] } } },
  { id: 'a2', name: 'Revisar ahora (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 300], parameters: {} },
  // 1. Recibos de Stripe
  code('r0', 'Recibos 60 días', 220, 0, `return [{ json: { q: ${JSON.stringify(RECIBOS + ' newer_than:60d')} } }];`),
  code('r0b', 'Todos los recibos', 220, 150, `return [{ json: { q: ${JSON.stringify(RECIBOS)} } }];`),
  http('r1', 'Buscar recibos', 440, 80, { parameters: { url: GMAIL, ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'q', value: '={{ $json.q }}' }, { name: 'maxResults', value: '500' }] }, options: {} }, ...credG, ...reintentos }),
  code('r2', 'Un ítem por recibo', 660, 80, 'return $input.all().flatMap((i) => (i.json.messages || []).map((m) => ({ json: { id: m.id } })));'),
  http('r3', 'Leer recibo', 880, 80, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}', ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'format', value: 'full' }] }, options: lotes }, ...credG, ...reintentos }),
  code('r4', 'Recibo de Explee', 1100, 80, recibo),
  http('r5', 'Bajar PDF', 1320, 80, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}/attachments/{{ $json.adjunto }}', ...gmail, options: lotes }, ...credG, ...reintentos }),
  code('r6', 'PDF a archivo', 1540, 80, pdfArchivo, { mode: 'runOnceForEachItem' }),
  http('r7', 'Subir PDF a Supabase', 1760, 80, { parameters: { url: '=' + SUPABASE + "/storage/v1/object/facturas/{{ $('Recibo de Explee').item.json.archivo }}",
    method: 'POST', ...auth, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-upsert', value: 'true' }, { name: 'Content-Type', value: 'application/pdf' }] },
    sendBody: true, contentType: 'binaryData', inputDataFieldName: 'pdf', options: {} }, ...credS }),
  http('r8', 'Filas existentes', 1980, 80, { executeOnce: true, alwaysOutputData: true, parameters: { url: FILAS, ...auth, options: {} }, ...credS }),
  code('r9', 'Unir recibos', 2200, 80, unir),
  http('r10', 'Guardar recibos', 2420, 80, { parameters: guardar('resolution=merge-duplicates'), ...credS }),
  // 2. API de Explee
  http('c1', 'Depósitos de saldo', 220, 400, { parameters: { url: ACTIVIDAD, ...auth, options: {} }, ...credE, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  http('c1b', 'Filas actuales', 440, 400, { executeOnce: true, alwaysOutputData: true, parameters: { url: FILAS, ...auth, options: {} }, ...credS }),
  code('c2', 'Recargas', 660, 400, recargas),
  http('c3', 'Guardar recargas nuevas', 880, 400, { parameters: guardar('resolution=ignore-duplicates'), ...credS }),
  http('c4', 'Marcar carga', 1100, 400, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...auth,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'explee-facturas', p_filas: $('Recargas').first().json.filas.length }) }}", options: {} }, ...credS }),
];

const c = (a, ...b) => ({ [a]: { main: [b.map((x) => ({ node: x, type: 'main', index: 0 }))] } });
const cadena = (...n) => Object.assign({}, ...n.slice(1).map((b, i) => c(n[i], b)));
const connections = {
  ...c('Cada día 7:05', 'Recibos 60 días', 'Depósitos de saldo'),
  ...c('Revisar ahora (a mano)', 'Todos los recibos', 'Depósitos de saldo'),
  ...c('Recibos 60 días', 'Buscar recibos'),
  ...c('Todos los recibos', 'Buscar recibos'),
  ...cadena('Buscar recibos', 'Un ítem por recibo', 'Leer recibo', 'Recibo de Explee', 'Bajar PDF', 'PDF a archivo', 'Subir PDF a Supabase',
    'Filas existentes', 'Unir recibos', 'Guardar recibos'),
  ...cadena('Depósitos de saldo', 'Filas actuales', 'Recargas', 'Guardar recargas nuevas', 'Marcar carga'),
};

fs.writeFileSync(path.join(__dirname, 'f25-recargas-explee.json'), JSON.stringify({ name: 'F25 · Recargas de Explee (recibos de Stripe + API → Supabase)', nodes: nodos, connections,
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
