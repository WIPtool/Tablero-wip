// Arma n8n/f21-facturas-proveedores.json: F21 · Facturas de proveedores (Gmail → Supabase).
// Lee los correos de cobro de Google Workspace (payments-noreply@google.com) en misha@wiptool.com con la credencial
// "Google account" (necesita el permiso gmail.readonly), guarda el PDF de cada factura en el bucket privado "facturas"
// de Supabase y una fila por factura (proveedor_factura) y por pago recibido o rechazado (proveedor_movimiento).
// También lee los recibos de Anthropic (invoice+statements@mail.anthropic.com), con la factura en PDF y el monto del correo:
// los dirigidos a la cuenta de claude.ai de una persona (PERSONAS; llegan reenviados por un filtro de Gmail) van a su
// pestaña ('claude-misha'…); las compras de créditos de la API a misha@wiptool.com, a Claude Platform ('claude-platform').
// Y los avisos de cobro de AWS (no-reply@amazonaws.com a info@aplicando.co, que llegan a este buzón): pagos recibidos y cobros
// fallidos (proveedor_movimiento, 'aws'); con ellos el tablero deduce qué facturas de AWS están pagadas.
// Corre cada día a las 6:30 a. m. (últimos 60 días); el disparador manual carga todo el histórico.
// Uso: node n8n/armar-f21.cjs   (después se importa en n8n.wiptool.com)
const fs = require('fs');
const path = require('path');

const CRED_GOOGLE = { id: 'jnLeMVYFho7CTP6Q', name: 'Google account' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const CONSULTA = '((from:payments-noreply@google.com subject:"Google Workspace") OR (from:mail.anthropic.com subject:receipt) OR '
  + '(from:no-reply@amazonaws.com (subject:"Gracias por el pago" OR subject:"Intento de pago exitoso" OR subject:"pendientes de pago" OR '
  + 'subject:"riesgo de suspensión" OR subject:"restringido por impago" OR subject:"Payment Failure" OR subject:"Thank you for your payment")))';

// Clasifica cada correo: factura (con su PDF), pago recibido o pago rechazado.
const clasificar = String.raw`
const texto = (p, tipo = 'text/plain') => {
  if (!p) return '';
  if (p.mimeType === tipo && p.body && p.body.data) return Buffer.from(p.body.data, 'base64').toString('utf8');
  for (const h of p.parts || []) { const t = texto(h, tipo); if (t) return t; }
  return '';
};
const adjuntos = (p, out = []) => {
  if (!p) return out;
  if (p.filename && /\.pdf$/i.test(p.filename) && p.body && p.body.attachmentId) out.push({ nombre: p.filename, id: p.body.attachmentId });
  for (const h of p.parts || []) adjuntos(h, out);
  return out;
};
const numero = (s) => {
  s = String(s).replace(/[^\d.,]/g, '');
  const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (i >= 0 && s.length - i - 1 === 2) return Number(s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1));
  return Number(s.replace(/[.,]/g, ''));
};
// Cuenta de claude.ai de cada persona → su pestaña en Gastos › Claude.
const PERSONAS = { 'mikfobe@gmail.com': 'claude-misha', 'jjohanvalencia112@gmail.com': 'claude-johan' };
const salida = [];
for (const it of $input.all()) {
  const m = it.json;
  const cab = Object.fromEntries((m.payload.headers || []).map((h) => [h.name.toLowerCase(), h.value]));
  const asunto = cab.subject || '';
  const cuerpo = texto(m.payload);
  const fecha = new Date(Number(m.internalDate) - 5 * 3600e3).toISOString().slice(0, 10);
  const cuenta = ((cuerpo.match(/ID de cliente de Google Workspace:\s*([a-z0-9.-]+\.[a-z]{2,})/i)
    || cuerpo.match(/Dominio\s+([a-z0-9.-]+\.[a-z]{2,})/i)
    || asunto.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+)\s*(?:está|$)/i)
    || asunto.match(/(?:de|dominio)\s+([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i) || [])[1] || '').toLowerCase();
  const correo_url = 'https://mail.google.com/mail/u/?authuser=misha@wiptool.com#all/' + m.id;
  // Recibos de Anthropic (Stripe): trae la factura (Invoice-….pdf) y el recibo (Receipt-….pdf); se guarda la factura.
  if (/@mail\.anthropic\.com/i.test(cab.from || '')) {
    const t = cuerpo || texto(m.payload, 'text/html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const para = ((cab.to || '').match(/[\w.+-]+@[\w.-]+/) || [''])[0].toLowerCase();
    const proveedor = PERSONAS[para] || (/credit purchase/i.test(t) ? 'claude-platform' : '');
    if (!proveedor) continue; // suscripción de una cuenta que no está en PERSONAS
    const pdfs = adjuntos(m.payload);
    const pdf = pdfs.find((a) => /^invoice/i.test(a.nombre)) || pdfs[0];
    const n = ((pdf && pdf.nombre.match(/^Invoice-(.+)\.pdf$/i)) || asunto.match(/#([\d-]+)/) || [])[1] || '';
    if (!n || !pdf) continue;
    const p = t.match(/Amount paid\s+\$\s?([\d.,]+)/i) || t.match(/Total\s+\$\s?([\d.,]+)/i);
    salida.push({ json: { id: m.id, proveedor, cuenta: para, fecha, correo_url, asunto, tipo: 'factura', numero: n,
      adjunto: pdf.id, monto: p ? numero(p[1]) : null, estado: 'PAID' } });
    continue;
  }
  // Avisos de cobro de AWS: pago recibido (con las facturas que pagó y el saldo que queda) o cobro fallido. El cobro automático
  // que sale bien no avisa; el tablero da por pagada una factura si después hubo un pago o ningún cobro fallido.
  if (/@amazonaws\.com/i.test(cab.from || '')) {
    const t = cuerpo || texto(m.payload, 'text/html').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const fila = { id: m.id, proveedor: 'aws', cuenta: (t.match(/\b(\d{12})\b/) || [])[1] || '', fecha, monto: null, moneda: 'USD', detalle: '', correo_url };
    const tarjeta = (t.match(/(?:tarjeta|Card ending)\s+(\d{4})(?![\s\S]*(?:tarjeta|Card ending)\s+\d{4})/i) || [])[1];
    if (/gracias por el pago|pago exitoso|thank you for your payment/i.test(asunto)) {
      const facturas = [...new Set([...t.matchAll(/Invoice\s+(\d{6,})/gi)].map((x) => x[1]))];
      const importe = t.match(/charged the amount of\s*([\d.,]+)\s*USD/i) || t.match(/importe de\s*([\d.,]+)\s*USD/i);
      const saldo = t.match(/outstanding balance of\s*([\d.,]+)\s*USD/i);
      const detalle = facturas.length ? 'Factura ' + facturas.join(', ') + (saldo ? ' · saldo pendiente ' + saldo[1] + ' USD' : '')
        : tarjeta ? 'Cobrado a la tarjeta de respaldo ••' + tarjeta : '';
      salida.push({ json: { id: m.id, tipo: 'pago', fila: { ...fila, tipo: 'pago', monto: importe ? numero(importe[1]) : null, detalle } } });
    } else {
      const motivo = /restringid/i.test(asunto) ? 'Cuenta restringida por impago' : /suspensi/i.test(asunto) ? 'Riesgo de suspensión'
        : /vencidos/i.test(asunto) ? 'Cargos vencidos' : 'Cobro rechazado';
      salida.push({ json: { id: m.id, tipo: 'rechazo', fila: { ...fila, tipo: 'rechazo', detalle: motivo + (tarjeta ? ' · tarjeta ••' + tarjeta : '') } } });
    }
    continue;
  }
  const base = { id: m.id, proveedor: 'google-workspace', cuenta, fecha, correo_url, asunto };
  if (/rechaz|declin/i.test(asunto)) {
    const t = cuerpo.match(/(Visa|Mastercard|American Express|Amex|Discover)[^\d]{0,20}(\d{4})/i);
    salida.push({ json: { ...base, tipo: 'rechazo', fila: { id: m.id, proveedor: base.proveedor, cuenta, fecha, tipo: 'rechazo', monto: null, moneda: 'USD',
      detalle: t ? t[1] + ' ••' + t[2] : '', correo_url } } });
  } else if (/recibimos el pago|se recibió el pago|payment received/i.test(asunto + ' ' + cuerpo.slice(0, 300))) {
    const p = cuerpo.match(/pago de\s+(USD|COP|EUR|US\$)\s?([\d.,]+)/i) || cuerpo.match(/(USD|COP|EUR|US\$)\s?([\d.,]+)/);
    salida.push({ json: { ...base, tipo: 'pago', fila: { id: m.id, proveedor: base.proveedor, cuenta, fecha, tipo: 'pago',
      monto: p ? numero(p[2]) : null, moneda: p ? p[1].replace('US$', 'USD').toUpperCase() : 'USD', detalle: '', correo_url } } });
  } else if (/factura|invoice/i.test(asunto)) {
    const pdf = adjuntos(m.payload)[0];
    const n = (cuerpo.match(/N[úu]mero de factura\s*:?\s*(\d+)/i) || (pdf ? pdf.nombre.match(/(\d+)/) : null) || [])[1] || '';
    if (!n || !pdf) continue; // sin número o sin PDF no hay qué guardar
    salida.push({ json: { ...base, tipo: 'factura', numero: n, adjunto: pdf.id } });
  }
}
return salida;
`;

// Pasa el adjunto (base64url de Gmail) a un archivo binario "pdf".
const pdfArchivo = String.raw`
const f = $('¿Es factura?').item.json;
const b64 = String($json.data || '').replace(/-/g, '+').replace(/_/g, '/');
return { json: f, binary: { pdf: { data: b64, mimeType: 'application/pdf', fileName: f.numero + '.pdf', fileExtension: 'pdf' } } };
`;

// Lee el total de la factura del texto del PDF y arma la fila.
const monto = String.raw`
const f = $('PDF a archivo').item.json;
const bin = $('PDF a archivo').item.binary;
const t = String($json.text || '').replace(/\u00a0/g, ' ');
const numero = (s) => {
  s = String(s).replace(/[^\d.,]/g, '');
  const i = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (i >= 0 && s.length - i - 1 === 2) return Number(s.slice(0, i).replace(/[.,]/g, '') + '.' + s.slice(i + 1));
  return Number(s.replace(/[.,]/g, ''));
};
// Montos con moneda (USD 73.70, US$ 73,70, $73.70, COP 250.000,00); el total es el que sigue a la palabra "total".
const re = /(USD|COP|EUR|US\$|\$)\s?(\d[\d.,]*\d)|(\d[\d.,]*\d)\s?(USD|COP|EUR)/g;
let total = null, moneda = 'USD', ultimo = null;
for (const linea of t.split(/\n/)) {
  const montos = [...linea.matchAll(re)].map((x) => ({ v: numero(x[2] || x[3]), m: (x[1] || x[4] || '').replace('US$', 'USD').replace('$', 'USD') }));
  if (!montos.length) continue;
  ultimo = montos[montos.length - 1];
  if (/total/i.test(linea)) { total = montos[montos.length - 1].v; moneda = montos[montos.length - 1].m || moneda; }
}
if (total == null && ultimo) { total = ultimo.v; moneda = ultimo.m || moneda; }
if (f.monto != null) { total = f.monto; moneda = 'USD'; } // los recibos de Anthropic traen el monto en el correo
const proveedor = f.proveedor || 'google-workspace';
const archivo = proveedor + '/' + (f.cuenta || 'sin-cuenta') + '/' + f.numero + '.pdf';
return { json: { ...f, archivo, fila: { id: proveedor + ':' + f.numero, proveedor, cuenta: f.cuenta, numero: f.numero,
  fecha: f.fecha, monto: Number.isFinite(total) ? total : null, moneda: moneda || 'USD', archivo, correo_url: f.correo_url,
  ...(f.estado ? { estado: f.estado } : {}) },
  texto_pdf: t.slice(0, 1500) }, binary: bin };
`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const gmail = { authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api' };
// Gmail limita la cuota por minuto: las llamadas por correo van de a 3 cada 2 segundos y se reintentan si Gmail corta.
const lotes = { batching: { batch: { batchSize: 3, batchInterval: 2000 } } };
const reintentos = { retryOnFail: true, maxTries: 5, waitBetweenTries: 5000 };
const supa = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const credG = { credentials: { googleOAuth2Api: CRED_GOOGLE } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };
const upsert = (tabla) => ({
  url: SUPABASE + '/rest/v1/' + tabla + '?on_conflict=id', method: 'POST', ...supa,
  sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.fila) }}', options: {},
});

const nodos = [
  { id: 'a1', name: 'Cada día 6:30', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '30 6 * * *' }] } } },
  { id: 'a2', name: 'Cargar histórico (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} },
  { id: 'b1', name: 'Últimos 60 días', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0],
    parameters: { jsCode: `return [{ json: { q: ${JSON.stringify(CONSULTA + ' newer_than:60d')} } }];` } },
  { id: 'b2', name: 'Todo el histórico', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 200],
    parameters: { jsCode: `return [{ json: { q: ${JSON.stringify(CONSULTA)} } }];` } },
  http('c1', 'Buscar correos', 440, 100, { parameters: { url: GMAIL, ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'q', value: '={{ $json.q }}' }, { name: 'maxResults', value: '500' }] }, options: {} }, ...credG }),
  { id: 'c2', name: 'Un ítem por correo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 100],
    parameters: { jsCode: 'return $input.all().flatMap((i) => (i.json.messages || []).map((m) => ({ json: { id: m.id } })));' } },
  http('c3', 'Leer correo', 880, 100, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}', ...gmail, sendQuery: true,
    queryParameters: { parameters: [{ name: 'format', value: 'full' }] }, options: lotes }, ...credG, ...reintentos }),
  { id: 'c4', name: 'Clasificar', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1100, 100], parameters: { jsCode: clasificar.trim() } },
  { id: 'c5', name: '¿Es factura?', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [1320, 100],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, combinator: 'and',
      conditions: [{ id: 'k1', leftValue: '={{ $json.tipo }}', rightValue: 'factura', operator: { type: 'string', operation: 'equals' } }] }, options: {} } },
  http('d1', 'Bajar PDF', 1540, 0, { parameters: { url: '=' + GMAIL + '/{{ $json.id }}/attachments/{{ $json.adjunto }}', ...gmail, options: lotes }, ...credG, ...reintentos }),
  { id: 'd2', name: 'PDF a archivo', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1760, 0],
    parameters: { jsCode: pdfArchivo.trim(), mode: 'runOnceForEachItem' } },
  { id: 'd3', name: 'Leer PDF', type: 'n8n-nodes-base.extractFromFile', typeVersion: 1, position: [1980, 0],
    parameters: { operation: 'pdf', binaryPropertyName: 'pdf', options: {} } },
  { id: 'd4', name: 'Total de la factura', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2200, 0],
    parameters: { jsCode: monto.trim(), mode: 'runOnceForEachItem' } },
  http('d5', 'Subir PDF a Supabase', 2420, 0, { parameters: { url: '=' + SUPABASE + '/storage/v1/object/facturas/{{ $json.archivo }}',
    method: 'POST', ...supa, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-upsert', value: 'true' }, { name: 'Content-Type', value: 'application/pdf' }] },
    sendBody: true, contentType: 'binaryData', inputDataFieldName: 'pdf', options: {} }, ...credS }),
  { id: 'd6', name: 'Fila de la factura', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2640, 0],
    parameters: { jsCode: "return { json: { fila: $('Total de la factura').item.json.fila } };", mode: 'runOnceForEachItem' } },
  http('d7', 'Guardar factura', 2860, 0, { parameters: upsert('proveedor_factura'), ...credS }),
  http('e1', 'Guardar pago o rechazo', 1540, 220, { parameters: upsert('proveedor_movimiento'), ...credS }),
  http('f1', 'Marcar carga', 3080, 120, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...supa,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'workspace', p_filas: $('Clasificar').all().length }) }}", options: {} }, ...credS }),
];

const c = (a, b, i = 0) => ({ [a]: { main: [[{ node: b, type: 'main', index: i }]] } });
const connections = {
  ...c('Cada día 6:30', 'Últimos 60 días'),
  ...c('Cargar histórico (a mano)', 'Todo el histórico'),
  ...c('Últimos 60 días', 'Buscar correos'),
  ...c('Todo el histórico', 'Buscar correos'),
  ...c('Buscar correos', 'Un ítem por correo'),
  ...c('Un ítem por correo', 'Leer correo'),
  ...c('Leer correo', 'Clasificar'),
  ...c('Clasificar', '¿Es factura?'),
  '¿Es factura?': { main: [[{ node: 'Bajar PDF', type: 'main', index: 0 }], [{ node: 'Guardar pago o rechazo', type: 'main', index: 0 }]] },
  ...c('Bajar PDF', 'PDF a archivo'),
  ...c('PDF a archivo', 'Leer PDF'),
  ...c('Leer PDF', 'Total de la factura'),
  ...c('Total de la factura', 'Subir PDF a Supabase'),
  ...c('Subir PDF a Supabase', 'Fila de la factura'),
  ...c('Fila de la factura', 'Guardar factura'),
  ...c('Guardar factura', 'Marcar carga'),
  ...c('Guardar pago o rechazo', 'Marcar carga'),
};

const flujo = {
  name: 'F21 · Facturas de proveedores (Gmail → Supabase)',
  nodes: nodos,
  connections,
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', errorWorkflow: 'EnFP5wE2LSfxcvxi' },
};
fs.writeFileSync(path.join(__dirname, 'f21-facturas-proveedores.json'), JSON.stringify(flujo, null, 2));
console.log('n8n/f21-facturas-proveedores.json:', nodos.length, 'nodos');
