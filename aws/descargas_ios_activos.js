/* eslint-disable @typescript-eslint/no-require-imports -- Lambda CommonJS en línea (Code.ZipFile) */
// Lambda "tablero-descargas-ios-activos" (cuenta 329792044951, us-east-1, nodejs22.x): dispositivos activos por mes de la
// app WIP Colaboradores (Apple ID 6471438127) en iOS, para Operaciones › Descargas app (tabla app_activos_mensual).
// Apple no da instalaciones activas por la API de ventas; la cifra sale de su API de analíticas (Analytics Reports):
// informe "App Sessions Standard", granularidad mensual, columna Unique Devices (dispositivos con al menos una sesión en
// el mes). Solo cuenta a quienes aceptaron compartir analíticas con los desarrolladores, y como el informe viene partido
// por versión, dispositivo y origen, la suma puede contar dos veces un mismo dispositivo: es una aproximación.
// La primera corrida crea en App Store Connect las solicitudes de informes (ONGOING y ONE_TIME_SNAPSHOT para el histórico);
// Apple tarda uno o dos días en generar los datos.
// Claves en el secreto "tablero-wip": appstore_issuer_id, appstore_key_id, appstore_private_key.
// Corrida diaria 7:30 a. m. Bogotá (regla "tablero-descargas-apps-diario"). Despliegue: pila "tablero-descargas-apps",
// código en línea (Code.ZipFile, index.js, máx. 4.096 caracteres, minificado con el terser de Next).
const crypto = require('crypto');
const zlib = require('zlib');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const SB = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const API = 'https://api.appstoreconnect.apple.com/v1/';
const APP_ID = '6471438127';
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
async function pedir(url, op = {}) {
  const r = await fetch(url, op);
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 300));
  return Buffer.from(await r.arrayBuffer());
}

exports.handler = async () => {
  const s = JSON.parse((await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: 'tablero-wip' }))).SecretString);
  const clave = s['supabase_secret_key misha@wiptool.com'];
  const sb = (ruta, cuerpo, extra = {}) => pedir(SB + ruta, { method: 'POST', body: JSON.stringify(cuerpo),
    headers: { apikey: clave, 'Content-Type': 'application/json', ...extra } });
  try {
    const t = Math.floor(Date.now() / 1000);
    const d = b64({ alg: 'ES256', kid: s.appstore_key_id, typ: 'JWT' }) + '.' + b64({ iss: s.appstore_issuer_id, iat: t, exp: t + 1100, aud: 'appstoreconnect-v1' });
    // la consola de Secrets Manager cambia los saltos de línea por espacios: se rearma el PEM
    const pem = '-----BEGIN PRIVATE KEY-----\n' + s.appstore_private_key.replace(/-----[^-]+-----|\\n|\s/g, '').match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----';
    const H = { Authorization: 'Bearer ' + d + '.' + crypto.sign('sha256', Buffer.from(d), { key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url') };
    const get = async (ruta) => JSON.parse(await pedir(ruta.startsWith('http') ? ruta : API + ruta, { headers: H }));

    // Solicitudes de informes de la app; si falta alguna, se crea (Apple genera los datos en uno o dos días).
    let solicitudes = (await get('apps/' + APP_ID + '/analyticsReportRequests')).data;
    for (const tipo of ['ONGOING', 'ONE_TIME_SNAPSHOT']) {
      if (solicitudes.some((x) => x.attributes.accessType === tipo)) continue;
      await pedir(API + 'analyticsReportRequests', { method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {
        type: 'analyticsReportRequests', attributes: { accessType: tipo }, relationships: { app: { data: { type: 'apps', id: APP_ID } } } } }) });
    }
    solicitudes = (await get('apps/' + APP_ID + '/analyticsReportRequests')).data;

    // Dispositivos únicos por mes: suma de Unique Devices de cada mes en los informes mensuales de todas las solicitudes.
    const meses = {};
    for (const sol of solicitudes) {
      const informes = (await get('analyticsReportRequests/' + sol.id + '/reports?filter[name]=App%20Sessions%20Standard')).data;
      for (const inf of informes) {
        for (const ins of (await get('analyticsReports/' + inf.id + '/instances?filter[granularity]=MONTHLY&limit=200')).data) {
          const vistos = {};
          for (const seg of (await get('analyticsReportInstances/' + ins.id + '/segments')).data) {
            const [cab, ...lineas] = zlib.gunzipSync(await pedir(seg.attributes.url)).toString().trim().split('\n'), c = cab.split('\t');
            for (const l of lineas) {
              const v = Object.fromEntries(l.split('\t').map((x, i) => [c[i], x])), mes = (v.Date || '').slice(0, 7) + '-01';
              vistos[mes] = (vistos[mes] || 0) + (+v['Unique Devices'] || 0);
            }
          }
          // ONGOING y SNAPSHOT pueden traer el mismo mes: se queda el mayor.
          for (const m in vistos) meses[m] = Math.max(meses[m] || 0, vistos[m]);
        }
      }
    }
    const filas = Object.entries(meses).map(([mes, activos]) => ({ tienda: 'ios', app: 'WIP Colaboradores', mes, activos }));
    if (filas.length) await sb('/rest/v1/app_activos_mensual?on_conflict=tienda,app,mes', filas, { Prefer: 'resolution=merge-duplicates,return=minimal' });
    await sb('/rest/v1/rpc/registrar_carga', { p_fuente: 'ios-activos', p_filas: filas.length });
    return { solicitudes: solicitudes.map((x) => x.attributes.accessType), meses };
  } catch (e) {
    await sb('/rest/v1/rpc/registrar_error', { p_fuente: 'ios-activos', p_mensaje: String(e.message).slice(0, 400) });
    throw e;
  }
};
