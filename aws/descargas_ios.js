/* eslint-disable @typescript-eslint/no-require-imports -- Lambda CommonJS en línea (Code.ZipFile) */
// Lambda "tablero-descargas-ios" (cuenta 329792044951, us-east-1, nodejs22.x): descargas de la app WIP Colaboradores en
// App Store para Operaciones › Descargas app.
//   Diarias (tabla app_descarga_diaria): Sales Reports SUMMARY diario; descargas = tipos de producto 1*, actualizaciones = 7*.
//   Apple solo guarda 365 días de informes diarios.
//   Totales (tabla app_descarga_resumen): informes YEARLY de los años cerrados desde 2023 y MONTHLY de los meses cerrados
//   del año en curso; el total histórico les suma las diarias del mes en curso. La respuesta trae "otras": las demás apps
//   con descargas en esos informes, para notar si la app tuvo otro Apple ID.
// Claves en el secreto "tablero-wip": appstore_issuer_id, appstore_key_id, appstore_private_key, appstore_vendor_number.
// Corrida diaria 7:30 a. m. Bogotá (regla "tablero-descargas-apps-diario"): últimos 10 días. Histórico: {"dias": 365}.
// Despliegue: pila "tablero-descargas-apps", código en línea (Code.ZipFile, index.js, máx. 4.096 caracteres, minificado con
// el terser de Next; solo caracteres ASCII), rol tablero-facturas-aws.
const crypto = require('crypto');
const zlib = require('zlib');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const SB = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const APP = 'WIP Colaboradores', APP_ID = '6471438127'; // se filtra por el Apple ID: el nombre de la app cambió con los años
const DESDE = 2023; // primer año con descargas en Android
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const esDescarga = (v) => v['Product Type Identifier'][0] === '1';
async function pedir(url, op = {}) {
  const r = await fetch(url, op);
  if (r.status === 404 || r.status === 410) return null; // 410: Apple ya no guarda ese informe
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

// Informe de ventas de Apple (frecuencia DAILY con fecha AAAA-MM-DD, versión 1_1; o MONTHLY con AAAA-MM, versión 1_0):
// filas de descargas y actualizaciones de todas las apps, o [] si no hay.
async function informe(s, k, frecuencia, fecha) {
  const z = await pedir('https://api.appstoreconnect.apple.com/v1/salesReports?filter[frequency]=' + frecuencia + '&filter[reportType]=SALES' +
    '&filter[reportSubType]=SUMMARY&filter[version]=' + (frecuencia === 'DAILY' ? '1_1' : '1_0') + '&filter[vendorNumber]=' + s.appstore_vendor_number + '&filter[reportDate]=' + fecha,
    { headers: { Authorization: 'Bearer ' + k, Accept: 'application/a-gzip' } });
  if (!z) return [];
  const [cab, ...lineas] = zlib.gunzipSync(z).toString().trim().split('\n'), c = cab.split('\t');
  return lineas.map((l) => Object.fromEntries(l.split('\t').map((x, i) => [c[i], x]))).filter((v) => /^[17]/.test(v['Product Type Identifier']));
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
      for (const v of (await informe(s, k, 'DAILY', f)).filter((v) => v['Apple Identifier'] === APP_ID)) {
        const id = f + v['Country Code'];
        const r = m.get(id) || { fecha: f, tienda: 'ios', app: APP, pais: v['Country Code'], descargas: 0, actualizaciones: 0 };
        r[esDescarga(v) ? 'descargas' : 'actualizaciones'] += +v.Units || 0;
        m.set(id, r);
      }
    }
    const filas = [...m.values()];
    if (filas.length) await sb('/rest/v1/app_descarga_diaria?on_conflict=fecha,tienda,app,pais', filas, P);
    // Totales: informes anuales de los años cerrados y mensuales de los meses cerrados del año en curso (Apple solo guarda
    // un año de mensuales y responde 410 a los más viejos; antes de 2025 la app no tiene informes en esta cuenta).
    const hoy = new Date().toISOString(), anio = +hoy.slice(0, 4), lista = [], periodos = [], otras = {};
    for (let a = DESDE; a < anio; a++) lista.push(['YEARLY', '' + a]);
    for (let m = 1; m < +hoy.slice(5, 7); m++) lista.push(['MONTHLY', anio + '-' + String(m).padStart(2, '0')]);
    for (const [frecuencia, periodo] of lista) {
      let descargas = 0;
      for (const v of (await informe(s, k, frecuencia, periodo)).filter(esDescarga)) {
        if (v['Apple Identifier'] === APP_ID) descargas += +v.Units || 0;
        else otras[v.Title + ' ' + v['Apple Identifier']] = (otras[v.Title + ' ' + v['Apple Identifier']] || 0) + (+v.Units || 0);
      }
      periodos.push({ tienda: 'ios', app: APP, periodo, descargas });
    }
    await sb('/rest/v1/app_descarga_resumen?on_conflict=tienda,app,periodo', periodos, P);
    await sb('/rest/v1/rpc/registrar_carga', { p_fuente: 'ios', p_filas: filas.length });
    return { filas: filas.length, total: periodos.reduce((t, x) => t + x.descargas, 0), con_descargas: periodos.filter((x) => x.descargas).map((x) => x.periodo), otras };
  } catch (e) {
    await sb('/rest/v1/rpc/registrar_error', { p_fuente: 'ios', p_mensaje: String(e.message).slice(0, 400) });
    throw e;
  }
};
