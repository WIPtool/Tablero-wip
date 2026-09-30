// Script de Google Ads → Tablero WIP.
// Se pega en Google Ads (cuenta Wip 609-428-5378): Herramientas > Acciones masivas > Secuencias de comandos.
// Programarlo "Diariamente". Cada vez envía los últimos DIAS días por campaña a n8n (F14), que los guarda en Supabase.
// Se reenvía año y medio completo cada día: son pocas filas y así el histórico queda cargado desde la primera ejecución.
var WEBHOOK = 'https://wiptool.app.n8n.cloud/webhook/gads-7c1e4b9a2f6d48e3a51c';
var DIAS = 540;

function main() {
  var cuenta = AdsApp.currentAccount();
  var zona = cuenta.getTimeZone();
  var formato = function (d) { return Utilities.formatDate(d, zona, 'yyyy-MM-dd'); };
  var hoy = new Date();
  var hasta = formato(hoy);
  var desde = formato(new Date(hoy.getTime() - (DIAS - 1) * 86400000));

  var consulta = 'SELECT segments.date, campaign.id, campaign.name, metrics.cost_micros, metrics.impressions, ' +
    'metrics.clicks, metrics.conversions FROM campaign WHERE segments.date BETWEEN \'' + desde + '\' AND \'' + hasta + '\'';
  var filas = [];
  var resultado = AdsApp.search(consulta);
  while (resultado.hasNext()) {
    var r = resultado.next();
    filas.push({
      fecha: r.segments.date,
      campana_id: String(r.campaign.id),
      campana: r.campaign.name,
      inversion: Number(r.metrics.costMicros || 0) / 1000000,
      impresiones: Number(r.metrics.impressions || 0),
      clics: Number(r.metrics.clicks || 0),
      conversiones: Number(r.metrics.conversions || 0)
    });
  }

  var respuesta = UrlFetchApp.fetch(WEBHOOK, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ desde: desde, hasta: hasta, moneda: cuenta.getCurrencyCode(), filas: filas }),
    muteHttpExceptions: true
  });
  Logger.log('Enviadas ' + filas.length + ' filas (' + desde + ' a ' + hasta + '). Respuesta de n8n: ' + respuesta.getResponseCode());
}
