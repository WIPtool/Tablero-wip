// Arma n8n/f24-facturas-brevo.json: F24 · Facturas de Brevo (Gmail → Supabase), para Marketing › Inversión.
// Brevo no da las facturas por su API pública. Desde el 2026-10-29 manda la factura de cada renovación a misha@wiptool.com
// (Brevo › Mi plan › Billing information: «Invoice recipient Email» y la casilla «receive your invoices by email»). El flujo
// busca esos correos con PDF, lee del PDF el número (SIB-…) y el total, guarda el PDF en el bucket privado "facturas"
// (brevo/SIB-….pdf) y una fila por factura en proveedor_factura (proveedor 'brevo').
// Corre cada día a las 6:55 a. m. (últimos 60 días); el disparador manual revisa todo el histórico.
// Uso: node n8n/armar-f24.cjs            → n8n/f24-facturas-brevo.json (se importa en n8n.wiptool.com)
//      node n8n/armar-f24.cjs <carpeta>   → además, en <carpeta>, un flujo temporal de prueba con webhook que recibe un PDF
//                                           y responde lo que leyó (se usó una vez para subir los 5 PDF del histórico).
const fs = require('fs');
const path = require('path');

const CRED_GOOGLE = { id: 'jnLeMVYFho7CTP6Q', name: 'Google account' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const CONSULTA = 'from:(brevo.com OR sendinblue.com) filename:pdf';

// Un ítem por cada PDF adjunto de los correos de Brevo.
const adjuntos = String.raw`
const pdfs = (p, out = []) => {
  if (!p) return out;
  if (p.filename && /\.pdf$/i.test(p.filename) && p.body && p.body.attachmentId) out.push({ nombre: p.filename, adjunto: p.body.attachmentId });
  for (const h of p.parts || []) pdfs(h, out);
  return out;
};
const salida = [];
for (const it of $input.all()) {
  const m = it.json;
  const asunto = ((m.payload.headers || []).find((h) => h.name.toLowerCase() === 'subject') || {}).value || '';
  for (const a of pdfs(m.payload)) salida.push({ json: { id: m.id, ...a, asunto,
    fecha: new Date(Number(m.internalDate) - 5 * 3600e3).toISOString().slice(0, 10), // hora de Colombia
    correo_url: 'https://mail.google.com/mail/u/?authuser=misha@wiptool.com#all/' + m.id } });
}
return salida;`;

// Pasa el adjunto (base64url de Gmail) a un archivo binario "pdf".
const pdfArchivo = String.raw`
const f = $('Adjuntos PDF').item.json;
const b64 = String($json.data || '').replace(/-/g, '+').replace(/_/g, '/');
return { json: f, binary: { pdf: { data: b64, mimeType: 'application/pdf', fileName: f.nombre, fileExtension: 'pdf' } } };`;

// Lee del texto del PDF el número de factura (SIB-…) y el total. Los PDF que no son facturas de Brevo se descartan.
const factura = String.raw`
const origen = $('PDF a archivo').all();
const aNumero = (s) => {
  s = String(s).replace(/[^\d.,]/g, '');
  const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (i >= 0 && s.length - i - 1 === 2) return Number(s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1));
  return Number(s.replace(/[.,]/g, ''));
};
const sib = (s) => (String(s || '').match(/SIB-\s?(\d{5,})/i) || [])[1];
// Montos con moneda: $17.00, US$ 17.00, USD 17.00 y, como los escribe Brevo en español, 17,00 $ ...
const re = /(USD|EUR|COP|US\$|\$|€)\s?(\d[\d.,]*\d)|(\d[\d.,]*\d)\s?(USD|EUR|COP|US\$|\$|€)/g;
const moneda = (x) => ({ 'US$': 'USD', '$': 'USD', '€': 'EUR' })[x] || x || 'USD';
const salida = [];
$input.all().forEach((it, i) => {
  const f = origen[i].json;
  const t = String(it.json.text || '').replace(/ /g, ' ');
  const n = sib(t) || sib(f.nombre) || sib(f.asunto);
  if (!n) return; // no es una factura de Brevo
  // El total: el último monto de la última línea que dice "total" (no "subtotal"); si no hay, el mayor monto del PDF.
  let total = null, mon = 'USD';
  const lineas = t.split(/\n/);
  lineas.forEach((linea, j) => {
    if (!/total/i.test(linea) || /sub\s?-?total/i.test(linea)) return;
    let montos = [...linea.matchAll(re)];
    if (!montos.length && lineas[j + 1]) montos = [...lineas[j + 1].matchAll(re)]; // el monto en la línea siguiente
    if (montos.length) { const x = montos[montos.length - 1]; total = aNumero(x[2] || x[3]); mon = moneda(x[1] || x[4]); }
  });
  if (total == null) {
    for (const x of t.matchAll(re)) { const v = aNumero(x[2] || x[3]); if (total == null || v > total) { total = v; mon = moneda(x[1] || x[4]); } }
  }
  const numero = 'SIB-' + n;
  const archivo = 'brevo/' + numero + '.pdf';
  // Estado: el sello «PAGADO» sale también en las que Brevo dio por perdidas, así que se mira la sección de pagos.
  // Cobrada: «Pagos -17,00 $» / «Se pagaron 17,00 $ … con MasterCard…». Dada por perdida («Written off»): «Ajustes -17,00 $» /
  // «17,00 $ cancelado el …». Si no hay ninguna de las dos, queda sin pagar. El tablero lista las no cobradas sin sumarlas.
  const estado = /Se pagaron|\bPagos\s+-|was paid|\bPayments?\s+-/i.test(t) ? 'PAID'
    : /cancelad[oa] el|\bAjustes\s+-|\bAdjustments?\s+-|written off|cancell?ed on/i.test(t) ? 'WRITTEN_OFF' : 'UNPAID';
  salida.push({ json: { numero, archivo, texto_pdf: t.slice(0, 1500), fila: { id: 'brevo:' + numero, proveedor: 'brevo', cuenta: 'Wip · Marketing', numero,
    fecha: f.fecha, moneda: mon, estado, periodo: '', archivo, correo_url: f.correo_url || '',
    ...(Number.isFinite(total) ? { monto: total } : {}) } }, binary: origen[i].binary });
});
return salida;`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const gmail = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api' };
const supa = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const credG = { credentials: { googleOAuth2Api: CRED_GOOGLE } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };
// Gmail limita la cuota por minuto: las llamadas por correo van de a 3 cada 2 segundos y se reintentan si Gmail corta.
const lotes = { batching: { batch: { batchSize: 3, batchInterval: 2000 } } };
const reintentos = { retryOnFail: true, maxTries: 5, waitBetweenTries: 5000 };

const leerPdf = (x, y) => ({ id: 'd3', name: 'Leer PDF', type: 'n8n-nodes-base.extractFromFile', typeVersion: 1, position: [x, y],
  parameters: { operation: 'pdf', binaryPropertyName: 'pdf', options: {} } });
const facturaNodo = (x, y) => ({ id: 'd4', name: 'Factura de Brevo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [x, y], parameters: { jsCode: factura.trim() } });
const subir = (x, y) => http('d5', 'Subir PDF a Supabase', x, y, { parameters: { url: '=' + SUPABASE + '/storage/v1/object/facturas/{{ $json.archivo }}',
  method: 'POST', ...supa, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-upsert', value: 'true' }, { name: 'Content-Type', value: 'application/pdf' }] },
  sendBody: true, contentType: 'binaryData', inputDataFieldName: 'pdf', options: {} }, ...credS });

const nodos = [
  { id: 'a1', name: 'Cada día 6:55', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '55 6 * * *' }] } } },
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
    queryParameters: { parameters: [{ name: 'format', value: 'full' }] }, options: lotes }, ...credG, ...reintentos }),
  { id: 'c4', name: 'Adjuntos PDF', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 100], parameters: { jsCode: adjuntos.trim() } },
  http('d1', 'Bajar PDF', 1320, 100, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}/attachments/{{ $json.adjunto }}', ...gmail, options: lotes }, ...credG, ...reintentos }),
  { id: 'd2', name: 'PDF a archivo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1540, 100],
    parameters: { jsCode: pdfArchivo.trim(), mode: 'runOnceForEachItem' } },
  leerPdf(1760, 100),
  facturaNodo(1980, 100),
  subir(2200, 100),
  { id: 'd6', name: 'Fila de la factura', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2420, 100],
    parameters: { jsCode: "return { json: { fila: $('Factura de Brevo').item.json.fila } };", mode: 'runOnceForEachItem' } },
  http('d7', 'Guardar factura', 2640, 100, { parameters: {
    url: SUPABASE + '/rest/v1/proveedor_factura?on_conflict=id', method: 'POST', ...supa,
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.fila) }}', options: {} }, ...credS }),
  http('f1', 'Marcar carga', 2860, 100, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...supa,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'brevo-facturas', p_filas: $('Factura de Brevo').all().length }) }}", options: {} }, ...credS }),
];

const c = (a, b) => ({ [a]: { main: [[{ node: b, type: 'main', index: 0 }]] } });
const cadena = (...n) => Object.assign({}, ...n.slice(1).map((b, i) => c(n[i], b)));
const connections = {
  ...c('Cada día 6:55', 'Últimos 60 días'),
  ...c('Cargar histórico (a mano)', 'Todo el histórico'),
  ...c('Últimos 60 días', 'Buscar correos'),
  ...c('Todo el histórico', 'Buscar correos'),
  ...cadena('Buscar correos', 'Un ítem por correo', 'Leer correo', 'Adjuntos PDF', 'Bajar PDF', 'PDF a archivo', 'Leer PDF', 'Factura de Brevo',
    'Subir PDF a Supabase', 'Fila de la factura', 'Guardar factura', 'Marcar carga'),
};

const ajustes = { executionOrder: 'v1', timezone: 'America/Bogota', errorWorkflow: 'EnFP5wE2LSfxcvxi' };
fs.writeFileSync(path.join(__dirname, 'f24-facturas-brevo.json'),
  JSON.stringify({ name: 'F24 · Facturas de Brevo (Gmail → Supabase)', nodes: nodos, connections, settings: ajustes }, null, 2));
console.log('ok · n8n/f24-facturas-brevo.json (' + nodos.length + ' nodos)');

// Flujo temporal de prueba: recibe un PDF (multipart, campo "pdf", más "fecha"), lo lee con el mismo código de F24,
// lo sube al bucket y responde lo que leyó. Ruta del webhook al azar; se borra después de usarlo.
const carpeta = process.argv[2];
if (carpeta) {
  const ruta = 'brevo-pdf-prueba-' + require('crypto').randomBytes(9).toString('hex');
  const recibir = String.raw`
const it = $input.item;
const clave = Object.keys(it.binary || {})[0];
const b = (it.json.body || {});
return { json: { id: 'prueba', nombre: (it.binary[clave] || {}).fileName || '', asunto: '', fecha: b.fecha || '', correo_url: '' }, binary: { pdf: it.binary[clave] } };`;
  const prueba = {
    name: 'Temporal · prueba PDF de Brevo (borrar)',
    nodes: [
      { id: 'w1', name: 'Recibir PDF', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: ruta,
        parameters: { httpMethod: 'POST', path: ruta, responseMode: 'lastNode', responseData: 'firstEntryJson', options: { allowedOrigins: '*' } } },
      { id: 'd2', name: 'PDF a archivo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0], parameters: { jsCode: recibir.trim(), mode: 'runOnceForEachItem' } },
      leerPdf(440, 0), facturaNodo(660, 0), subir(880, 0),
      { id: 'r1', name: 'Respuesta', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 0],
        parameters: { jsCode: "const f = $('Factura de Brevo').all(); const t = $('Leer PDF').first().json.text || '';\nreturn [{ json: { leidas: f.map((x) => ({ numero: x.json.numero, monto: x.json.fila.monto, moneda: x.json.fila.moneda, archivo: x.json.archivo })), texto: String(t).slice(0, 2500), subida: $input.all().map((x) => x.json) } }];" } },
    ],
    connections: cadena('Recibir PDF', 'PDF a archivo', 'Leer PDF', 'Factura de Brevo', 'Subir PDF a Supabase', 'Respuesta'),
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  };
  fs.writeFileSync(path.join(carpeta, 'f24-prueba.json'), JSON.stringify(prueba, null, 2));
  console.log('ok · prueba en ' + path.join(carpeta, 'f24-prueba.json') + ' · ruta ' + ruta);
}
