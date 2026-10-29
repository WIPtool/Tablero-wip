// Arma n8n/f22-facturas-meta.json: F22 · Cobros de Meta Ads (Graph API → Supabase), para Marketing › Inversión.
// Meta no da recibos por API (la arista "transactions" ya no existe y "business_invoices" es solo para facturación mensual),
// pero el registro de actividad de la cuenta publicitaria trae cada cobro ("Cuenta facturada", ad_account_billing_charge)
// con el monto, la moneda y el número de transacción. Se guarda una fila por cobro en proveedor_factura (proveedor 'meta');
// el tablero arma con el número el enlace al recibo en PDF, que se abre con la sesión de Meta de quien lo pide.
// Corre cada día a las 6:45 a. m. (últimos 60 días); el disparador manual carga todo el histórico.
// Uso: node n8n/armar-f22.cjs   (después se importa en n8n.wiptool.com)
const fs = require('fs');
const path = require('path');

const CRED_META = { id: 'mGflv9K19Myes2Fm', name: 'Meta Ads (lectura)' };
const CRED_SUPABASE = { id: 'LWRuov5D7s6ILPbQ', name: 'Supabase (tablero)' };
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const CUENTA = 'act_1212455492189816';
const ACTIVIDAD = `https://graph.facebook.com/v23.0/${CUENTA}/activities?fields=event_type,event_time,extra_data&limit=500`;

const desde = (dias) => `const d = new Date(Date.now() - ${dias} * 86400e3).toISOString().slice(0, 10);
return [{ json: { url: ${JSON.stringify(ACTIVIDAD)} + '&since=' + d } }];`;

// Un ítem por página de actividad → una sola lista de filas para guardar de una vez.
const cobros = String.raw`
const filas = [];
for (const it of $input.all()) {
  for (const a of (it.json.data || [])) {
    if (a.event_type !== 'ad_account_billing_charge') continue;
    let x = {};
    try { x = JSON.parse(a.extra_data || '{}'); } catch (e) { continue; }
    if (!x.transaction_id) continue;
    filas.push({
      id: 'meta:' + x.transaction_id, proveedor: 'meta', cuenta: 'Wip · ${CUENTA}', numero: x.transaction_id,
      fecha: new Date(new Date(a.event_time).getTime() - 5 * 3600e3).toISOString().slice(0, 10), // hora de Colombia
      monto: Number(x.new_value), moneda: (x.currency || 'COP').toUpperCase(), estado: 'PAID', periodo: '', archivo: '', correo_url: '',
    });
  }
}
return [{ json: { filas } }];`;

const http = (id, name, x, y, extra) => ({ id, name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [x, y], ...extra });
const supa = { authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth' };
const credM = { credentials: { httpHeaderAuth: CRED_META } };
const credS = { credentials: { httpHeaderAuth: CRED_SUPABASE } };

const nodos = [
  { id: 'a1', name: 'Cada día 6:45', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 0],
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '45 6 * * *' }] } } },
  { id: 'a2', name: 'Cargar histórico (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} },
  { id: 'b1', name: 'Últimos 60 días', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 0], parameters: { jsCode: desde(60) } },
  { id: 'b2', name: 'Todo el histórico', type: 'n8n-nodes-base.code', typeVersion: 2, position: [220, 200], parameters: { jsCode: desde(3650) } },
  // Meta pagina la actividad: se sigue paging.next hasta la última página.
  http('c1', 'Actividad de la cuenta', 440, 100, { parameters: { url: '={{ $json.url }}', ...supa, options: { pagination: { pagination: {
    paginationMode: 'responseContainsNextURL', nextURL: '={{ $response.body.paging && $response.body.paging.next }}',
    paginationCompleteWhen: 'other', completeExpression: '={{ !$response.body.paging || !$response.body.paging.next }}',
    limitPagesFetched: true, maxRequests: 60 } } } }, ...credM, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000 }),
  { id: 'c2', name: 'Cobros', type: 'n8n-nodes-base.code', typeVersion: 2, position: [660, 100], parameters: { jsCode: cobros.trim() } },
  http('c3', 'Guardar cobros', 880, 100, { parameters: {
    url: SUPABASE + '/rest/v1/proveedor_factura?on_conflict=id', method: 'POST', ...supa,
    sendHeaders: true, headerParameters: { parameters: [{ name: 'Prefer', value: 'resolution=merge-duplicates,return=minimal' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.filas) }}', options: {} }, ...credS }),
  http('c4', 'Marcar carga', 1100, 100, { executeOnce: true, parameters: { url: SUPABASE + '/rest/v1/rpc/registrar_carga', method: 'POST', ...supa,
    sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ p_fuente: 'meta-facturas', p_filas: $('Cobros').first().json.filas.length }) }}", options: {} }, ...credS }),
];

const c = (a, b) => ({ [a]: { main: [[{ node: b, type: 'main', index: 0 }]] } });
const connections = {
  ...c('Cada día 6:45', 'Últimos 60 días'),
  ...c('Cargar histórico (a mano)', 'Todo el histórico'),
  ...c('Últimos 60 días', 'Actividad de la cuenta'),
  ...c('Todo el histórico', 'Actividad de la cuenta'),
  ...c('Actividad de la cuenta', 'Cobros'),
  ...c('Cobros', 'Guardar cobros'),
  ...c('Guardar cobros', 'Marcar carga'),
};

const flujo = {
  name: 'F22 · Cobros de Meta Ads (Graph API → Supabase)',
  nodes: nodos,
  connections,
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', errorWorkflow: 'EnFP5wE2LSfxcvxi' },
};
fs.writeFileSync(path.join(__dirname, 'f22-facturas-meta.json'), JSON.stringify(flujo, null, 2));
console.log('ok · n8n/f22-facturas-meta.json (' + nodos.length + ' nodos)');
