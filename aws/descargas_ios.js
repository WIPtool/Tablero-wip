/* eslint-disable @typescript-eslint/no-require-imports -- Lambda CommonJS en línea (Code.ZipFile) */
// Lambda "tablero-descargas-ios" (cuenta 329792044951, us-east-1, nodejs22.x): descargas de la app WIP Colaboradores en
// App Store para Operaciones › Descargas app.
//   Diarias (tabla app_descarga_diaria): Sales Reports SUMMARY diario; descargas = tipos de producto 1*, actualizaciones = 7*.
//   Apple solo guarda 365 días de informes diarios.
//   Totales (tabla app_descarga_anual): informes YEARLY de cada año cerrado (Apple los guarda siempre); el total histórico
//   es la suma de los años cerrados más las diarias del año en curso. Apple no da instalaciones activas por esta API.
// Claves en el secreto "tablero-wip": appstore_issuer_id, appstore_key_id, appstore_private_key, appstore_vendor_number.
// Corrida diaria 7:30 a. m. Bogotá (regla "tablero-descargas-apps-diario"): últimos 10 días. Histórico: {"dias": 365}.
// Despliegue: pila "tablero-descargas-apps" (con la Lambda de Android), código en línea (Code.ZipFile, index.js, máx. 4.096
// caracteres, minificado con el terser de Next), rol tablero-facturas-aws.
const crypto = require('crypto');
const zlib = require('zlib');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const SB = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const APP = 'WIP Colaboradores', APP_ID = '6471438127'; // se filtra por el Apple ID: el nombre de la app cambió con los años
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
async function pedir(url, op = {}) {
  const r = await fetch(url, op);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

// Informe de ventas de Apple (frecuencia DAILY con fecha AAAA-MM-DD, versión 1_1; o YEARLY con AAAA, que solo existe en
// versión 1_0): filas de la app, o [] si no hay.
async function informe(s, k, frecuencia, fecha) {
  const z = await pedir('https://api.appstoreconnect.apple.com/v1/salesReports?filter[frequency]=' + frecuencia + '&filter[reportType]=SALES' +
    '&filter[reportSubType]=SUMMARY&filter[version]=' + (frecuencia === 'DAILY' ? '1_1' : '1_0') + '&filter[vendorNumber]=' + s.appstore_vendor_number + '&filter[reportDate]=' + fecha,
    { headers: { Authorization: 'Bearer ' + k, Accept: 'application/a-gzip' } });
  if (!z) return [];
  const [cab, ...lineas] = zlib.gunzipSync(z).toString().trim().split('\n'), c = cab.split('\t');
  return lineas.map((l) => Object.fromEntries(l.split('\t').map((x, i) => [c[i], x])))
    .filter((v) => v['Apple Identifier'] === APP_ID && /^[17]/.test(v['Product Type Identifier']));
}

exports.handler = async (event) => {
  const s = JSON.parse((await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: 'tablero-wip' }))).SecretString);
  const clave = s['supabase_secret_key misha@wiptool.com'], dias = Math.min(+(event || {}).dias || 10, 365);
  const sb = (ruta, cuerpo, extra = {}) => pedir(SB + ruta, { method: 'POST', body: JSON.stringify(cuerpo),
    headers: { apikey: clave, 'Content-Type': 'application/json', ...extra } });
  const P = { Prefer: 'resolution=merge-duplicates,return=minimal' };
  if (!s.appstore_key_id || !s.appstore_private_key || !s.appstore_vendor_number) return { pendiente: 'faltan las claves de App Store' };
  try {
    const t = Math.floor(Date.now() / 1000);
    const d = b64({ alg: 'ES256', kid: s.appstore_key_id, typ: 'JWT' }) + '.' + b64({ iss: s.appstore_issuer_id, iat: t, exp: t + 1100, aud: 'appstoreconnect-v1' });
    // la consola de Secrets Manager cambia los saltos de línea por espacios: se rearma el PEM
    const pem = '-----BEGIN PRIVATE KEY-----\n' + s.appstore_private_key.replace(/-----[^-]+-----|\\n|\s/g, '').match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----';
    const k = d + '.' + crypto.sign('sha256', Buffer.from(d), { key: pem, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    const m = new Map();
    for (let n = 1; n <= dias; n++) {
      const f = dia(n);
      for (const v of await informe(s, k, 'DAILY', f)) {
        const id = f + v['Country Code'];
        const r = m.get(id) || { fecha: f, tienda: 'ios', app: APP, pais: v['Country Code'], descargas: 0, actualizaciones: 0 };
        r[v['Product Type Identifier'][0] === '1' ? 'descargas' : 'actualizaciones'] += +v.Units || 0;
        m.set(id, r);
      }
    }
    const filas = [...m.values()];
    if (filas.length) await sb('/rest/v1/app_descarga_diaria?on_conflict=fecha,tienda,app,pais', filas, P);
    const anios = [];
    let motivo = '';
    for (let a = new Date().getFullYear() - 1; a >= 2015; a--) {
      let v;
      try { v = await informe(s, k, 'YEARLY', '' + a); } catch (e) { motivo = a + ': ' + e.message; break; } // Apple responde 400 a los años anteriores a la cuenta
      anios.push({ tienda: 'ios', app: APP, anio: a, descargas: v.filter((x) => x['Product Type Identifier'][0] === '1').reduce((t, x) => t + (+x.Units || 0), 0) });
    }
    await sb('/rest/v1/app_descarga_anual?on_conflict=tienda,app,anio', anios, P);
    await sb('/rest/v1/rpc/registrar_carga', { p_fuente: 'ios', p_filas: filas.length });
    return { filas: filas.length, anios: anios.filter((a) => a.descargas), motivo };
  } catch (e) {
    await sb('/rest/v1/rpc/registrar_error', { p_fuente: 'ios', p_mensaje: String(e.message).slice(0, 400) });
    throw e;
  }
};
