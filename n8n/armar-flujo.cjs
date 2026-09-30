// Arma n8n/f12-carga-tablero.json (el flujo para importar en n8n) a partir de trabajos.js y filas.js.
// Uso: node n8n/armar-flujo.cjs
const fs = require('fs');
const path = require('path');
const leer = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/\r\n/g, '\n');

const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co';

const flujo = {
  name: 'F12 · Carga del tablero (Analytics y Search Console → Supabase)',
  nodes: [
    {
      id: 'a1f0c0de-0001-4000-8000-000000000001', name: 'Cada hora', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2,
      position: [0, 0], parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 10 }] } },
    },
    {
      id: 'a1f0c0de-0002-4000-8000-000000000002', name: 'Cargar histórico (a mano)', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1,
      position: [0, 200], parameters: {},
    },
    {
      id: 'a1f0c0de-0003-4000-8000-000000000003', name: 'Trabajos', type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [240, 100], parameters: { jsCode: leer('trabajos.js') },
    },
    {
      id: 'a1f0c0de-0004-4000-8000-000000000004', name: 'Consultar Google', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [480, 100],
      parameters: {
        method: 'POST', url: '={{ $json.url }}',
        authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
        options: { batching: { batch: { batchSize: 1, batchInterval: 300 } } },
      },
    },
    {
      id: 'a1f0c0de-0005-4000-8000-000000000005', name: 'Filas', type: 'n8n-nodes-base.code', typeVersion: 2,
      position: [720, 100], parameters: { mode: 'runOnceForEachItem', jsCode: leer('filas.js') },
    },
    {
      id: 'a1f0c0de-0006-4000-8000-000000000006', name: 'Guardar en Supabase', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [960, 100],
      parameters: {
        method: 'POST', url: `${SUPABASE}/rest/v1/rpc/cargar`,
        authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
        sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json) }}',
        options: { batching: { batch: { batchSize: 1, batchInterval: 100 } } },
      },
    },
  ],
  connections: {
    'Cada hora': { main: [[{ node: 'Trabajos', type: 'main', index: 0 }]] },
    'Cargar histórico (a mano)': { main: [[{ node: 'Trabajos', type: 'main', index: 0 }]] },
    Trabajos: { main: [[{ node: 'Consultar Google', type: 'main', index: 0 }]] },
    'Consultar Google': { main: [[{ node: 'Filas', type: 'main', index: 0 }]] },
    Filas: { main: [[{ node: 'Guardar en Supabase', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1', timezone: 'America/Bogota', saveDataSuccessExecution: 'none' },
  pinData: {},
};

fs.writeFileSync(path.join(__dirname, 'f12-carga-tablero.json'), JSON.stringify(flujo, null, 2));
console.log('ok');
