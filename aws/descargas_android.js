/* eslint-disable @typescript-eslint/no-require-imports -- Lambda CommonJS en línea (Code.ZipFile) */
// Lambda "tablero-descargas-android" (cuenta 329792044951, us-east-1, nodejs22.x): descargas de la app WIP Colaboradores
// (paquete com.asiste) en Google Play para Operaciones › Descargas app (tabla app_descarga_diaria).
// Lee los informes de Play en su bucket de Cloud Storage (stats/installs/installs_com.asiste_<AAAAMM>_country.csv, UTF-16)
// con la cuenta de servicio tablero-descargas@tablero-wip.iam.gserviceaccount.com, invitada en Play Console con "Ver
// información de la app y descargar informes masivos". Además de las diarias guarda los contadores acumulados de cada día
// y país: Total User Installs (descargas totales) y Active Device Installs (instalaciones activas).
// Claves en el secreto "tablero-wip": play_bucket y play_cuenta_servicio_json.
// Corrida diaria 7:30 a. m. Bogotá (regla "tablero-descargas-apps-diario"): últimos 10 días. Histórico: {"dias": 400}.
// Despliegue: pila "tablero-descargas-apps" (con la Lambda de iOS), código en línea (Code.ZipFile, index.js, máx. 4.096
// caracteres, minificado con el terser de Next), rol tablero-facturas-aws.
const crypto = require('crypto');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const SB = 'https://tlpnkcroqenudzgiqzum.supabase.co';
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
const dia = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const entero = (x) => (x === undefined || x === '' ? null : +x);
async function pedir(url, op = {}) {
  const r = await fetch(url, op);
  if (!r.ok) throw new Error(r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

async function android(s, desde) {
  const cs = JSON.parse(s.play_cuenta_servicio_json), t = Math.floor(Date.now() / 1000);
  const d = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: cs.client_email, scope: 'https://www.googleapis.com/auth/devstorage.read_only',
    aud: 'https://oauth2.googleapis.com/token', iat: t, exp: t + 3600 });
  const a = d + '.' + crypto.sign('sha256', Buffer.from(d), cs.private_key).toString('base64url');
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
      if (v.Date >= desde) filas.push({ fecha: v.Date, tienda: 'android', app: 'com.asiste', pais: v.Country || '',
        descargas: +v['Daily User Installs'] || 0, actualizaciones: +v['Daily Device Upgrades'] || 0, desinstalaciones: +v['Daily User Uninstalls'] || 0,
        total_usuarios: entero(v['Total User Installs']), activos: entero(v['Active Device Installs']) });
    }
  }
  return filas;
}

exports.handler = async (event) => {
  const s = JSON.parse((await new SecretsManagerClient({}).send(new GetSecretValueCommand({ SecretId: 'tablero-wip' }))).SecretString);
  const k = s['supabase_secret_key misha@wiptool.com'];
  const sb = (ruta, cuerpo, extra = {}) => pedir(SB + ruta, { method: 'POST', body: JSON.stringify(cuerpo),
    headers: { apikey: k, 'Content-Type': 'application/json', ...extra } });
  if (!s.play_bucket || !s.play_cuenta_servicio_json) return { pendiente: 'faltan play_bucket y play_cuenta_servicio_json' };
  try {
    const filas = await android(s, dia(+(event || {}).dias || 10));
    for (let i = 0; i < filas.length; i += 1000)
      await sb('/rest/v1/app_descarga_diaria?on_conflict=fecha,tienda,app,pais', filas.slice(i, i + 1000), { Prefer: 'resolution=merge-duplicates,return=minimal' });
    await sb('/rest/v1/rpc/registrar_carga', { p_fuente: 'android', p_filas: filas.length });
    return { filas: filas.length, columnas: filas[0] && Object.keys(filas[0]).filter((c) => filas[0][c] !== null) };
  } catch (e) {
    await sb('/rest/v1/rpc/registrar_error', { p_fuente: 'android', p_mensaje: String(e.message).slice(0, 400) });
    throw e;
  }
};
