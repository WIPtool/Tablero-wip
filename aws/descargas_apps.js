// Lambda "tablero-descargas-apps" (cuenta 329792044951, us-east-1, nodejs22.x): carga las descargas de la app WIP en
// Operaciones › Descargas de la app (tabla app_descarga_diaria, supabase/033_descargas_apps.sql).
//   Android: informes de Google Play en su bucket de Cloud Storage (stats/installs/installs_<paquete>_<AAAAMM>_country.csv,
//            UTF-16), leídos con una cuenta de servicio invitada en Play Console ("Ver información de la app y descargar
//            informes masivos"). Solo la app WIP Colaboradores (paquete com.asiste); las de SBS se ignoran.
//   iOS:     App Store Connect API, Sales Reports SUMMARY diario (clave de API con rol Sales). Descargas = tipos de
//            producto 1*, actualizaciones = 7*; solo la app "WIP Colaboradores". Apple guarda solo 365 días de informes diarios.
// Claves en el secreto "tablero-wip": play_bucket, play_cuenta_servicio_json, appstore_issuer_id, appstore_key_id,
// appstore_private_key, appstore_vendor_number (si faltan las de una tienda, esa tienda se salta sin error).
// Corrida diaria 7:30 a. m. Bogotá (regla "tablero-descargas-apps-diario", cron(30 12 * * ? *) UTC): últimos 10 días.  Histórico a mano: invocar con {"dias": 365}.
// Despliegue: pila de CloudFormation "tablero-descargas-apps" con este código en línea (Code.ZipFile, index.js, máx. 4.096
// caracteres: se sube minificado con el terser de Next, ~3.970), regla diaria y rol tablero-facturas-aws.
const crypto = require('crypto');
const zlib = require('zlib');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const SB = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const b64 = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');
const jwt = (cab, cuerpo, clave, ec) => { const d = b64(cab) + '.' + b64(cuerpo);
  return d + '.' + crypto.sign('sha256', Buffer.from(d), ec ? { key: clave, dsaEncoding: 'ieee-p1363' } : clave).toString('base64url'); };
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
async function pedir(url, op = {}) {
  const r = await fetch(url, op);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

async function android(s, desde) {
  const cs = JSON.parse(s.play_cuenta_servicio_json), t = Math.floor(Date.now() / 1000);
  const a = jwt({ alg: 'RS256', typ: 'JWT' }, { iss: cs.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only',
    aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 }, cs.private_key);
  const tok = JSON.parse(await pedir('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + a })).access_token;
  const H = { headers: { Authorization: 'Bearer ' + tok } }, G = 'https://storage.googleapis.com/storage/v1/b/' + s.play_bucket + '/o';
  const lista = JSON.parse(await pedir(G + '?prefix=stats/installs/installs_com.asiste_', H)).items || [];
  const filas = [];
  for (const o of lista.filter((o) => o.name.endsWith('_country.csv') && o.name.slice(-18, -12) >= desde.replace('-', '').slice(0, 6))) {
    const [cab, ...lineas] = (await pedir(G + '/' + encodeURIComponent(o.name) + '?alt=media', H)).toString('utf16le').replace(/^﻿/, '').trim().split(/\r?\n/);
    const c = cab.split(',');
    for (const l of lineas) {
      const v = Object.fromEntries(l.split(',').map((x, i) => [c[i], x]));
      if (v.Date >= desde) filas.push({ fecha: v.Date, tienda: 'android', app: v['Package Name'], pais: v.Country || '',
        descargas: +v['Daily User Installs'] || 0, actualizaciones: +v['Daily Device Upgrades'] || 0, desinstalaciones: +v['Daily User Uninstalls'] || 0 });
    }
  }
  return filas;
}

async function ios(s, dias) {
  const t = Math.floor(Date.now() / 1000), m = new Map();
  const k = jwt({ alg: 'ES256', kid: s.appstore_key_id, typ: 'JWT' }, { iss: s.appstore_issuer_id, iat: t, exp: t + 1100, aud: 'appstoreconnect-v1' },
    // la consola de Secrets Manager cambia los saltos de línea por espacios: se rearma el PEM
    '-----BEGIN PRIVATE KEY-----\n' + s.appstore_private_key.replace(/-----[^-]+-----|\\n|\s/g, '').match(/.{1,64}/g).join('\n') + '\n-----END PRIVATE KEY-----', true);
  for (let n = 1; n <= Math.min(dias, 365); n++) {
    const f = dia(n), z = await pedir('https://api.appstoreconnect.apple.com/v1/salesReports?filter[frequency]=DAILY&filter[reportType]=SALES' +
      '&filter[reportSubType]=SUMMARY&filter[version]=1_1&filter[vendorNumber]=' + s.appstore_vendor_number + '&filter[reportDate]=' + f,
      { headers: { Authorization: 'Bearer ' + k, Accept: 'application/a-gzip' } });
    if (!z) continue;
    const [cab, ...lineas] = zlib.gunzipSync(z).toString().trim().split('\n'), c = cab.split('\t');
    for (const l of lineas) {
      const v = Object.fromEntries(l.split('\t').map((x, i) => [c[i], x])), tipo = v['Product Type Identifier'] || '';
      if (!/^[17]/.test(tipo) || v.Title !== 'WIP Colaboradores') continue;
      const id = f + '|' + v.Title + '|' + v['Country Code'];
      const r = m.get(id) || { fecha: f, tienda: 'ios', app: v.Title, pais: v['Country Code'], descargas: 0, actualizaciones: 0 };
      r[tipo[0] === '1' ? 'descargas' : 'actualizaciones'] += +v.Units || 0;
      m.set(id, r);
    }
  }
  return [...m.values()];
}

exports.handler = async (event) => {
  const s = JSON.parse((await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: 'tablero-wip' }))).SecretString);
  const k = s['supabase_secret_key misha@wiptool.com'], dias = +(event || {}).dias || 10;
  const sb = (ruta, cuerpo, extra = {}) => pedir(SB + ruta, { method: 'POST', body: JSON.stringify(cuerpo),
    headers: { apikey: k, 'Content-Type': 'application/json', ...extra } });
  // Cada tienda por separado: si una falla, la otra igual se carga y el error queda en cargas.
  const res = {}, errores = [];
  for (const [t, ok, f] of [['android', s.play_bucket && s.play_cuenta_servicio_json, () => android(s, dia(dias))],
    ['ios', s.appstore_key_id && s.appstore_private_key && s.appstore_vendor_number, () => ios(s, dias)]]) {
    if (!ok) continue;
    try {
      const filas = await f();
      for (let i = 0; i < filas.length; i += 1000)
        await sb('/rest/v1/app_descarga_diaria?on_conflict=fecha,tienda,app,pais', filas.slice(i, i + 1000), { Prefer: 'resolution=merge-duplicates,return=minimal' });
      res[t] = filas.length;
    } catch (e) { errores.push(t + ': ' + e.message); }
  }
  if (errores.length) await sb('/rest/v1/rpc/registrar_error', { p_fuente: 'apps', p_mensaje: errores.join(' | ').slice(0, 400) });
  else await sb('/rest/v1/rpc/registrar_carga', { p_fuente: 'apps', p_filas: (res.android || 0) + (res.ios || 0) });
  return { ...res, errores };
};
