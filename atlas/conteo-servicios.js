// Trigger programado de MongoDB Atlas "Tablero WIP · conteo de servicios" (proyecto wipglobal-platform-PROD).
// Corre una vez al día (3 a. m. de Colombia, cron 0 8 * * * en UTC) dentro de Atlas: cuenta los servicios de ServicesDB.Service por día de creación (hora de Colombia),
// compañía (owner.name), tipo y estado actual, y manda SOLO esos conteos a Supabase (cargar_servicios_atlas,
// supabase/022_servicios_plataforma.sql). Ningún dato de los servicios sale de Atlas.
//
// - Sin argumentos (el trigger): recarga los últimos DIAS días, porque el estado cambia después de creado el servicio.
//   ServicesDB.Service no tiene índice que empiece por createdDate: cada corrida recorre la colección (~800 mil, unos
//   segundos). No se filtra por _id porque su fecha no siempre coincide con createdDate (a veces es meses anterior).
// - Histórico, a mano desde el editor de la función: exports('2023-01-01') o exports('2023-01-01', '2024-12-31').
//   Rangos largos se mandan por meses.
// - La clave de carga es el Value "claveTablero" (enlazado al Secret "claveTableroSecreto"); se ve en Supabase con
//   select clave from claves_carga where fuente = 'plataforma';
// - La clave publicable de Supabase es pública por diseño (la misma que usa el navegador del tablero).

const DIAS = 45;
const SUPABASE = 'https://tlpnkcroqenudzgiqzum.supabase.co/rest/v1/rpc/cargar_servicios_atlas';
const PUBLICABLE = 'sb_publishable_PmKPJyqbHGuyiRP5QKskTg_YfPBxARV';
const ESTADOS = {
  0: 'Pendiente', 1: 'Por aprobar', 2: 'Sin conexión', 3: 'Aceptado', 4: 'Rechazado', 5: 'En camino', 6: 'En curso',
  7: 'Finalizado', 8: 'Fallido', 9: 'Cancelado', 10: 'Asignando proveedor', 11: 'Asignando colaborador',
};

// Fechas como texto AAAA-MM-DD en hora de Colombia (UTC-5, sin horario de verano).
const hoyColombia = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const sumarDias = (dia, n) => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const inicioColombia = (dia) => new Date(dia + 'T05:00:00Z'); // medianoche de Colombia en UTC
const finDeMes = (dia) => { const d = new Date(dia.slice(0, 7) + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 1); return sumarDias(d.toISOString().slice(0, 10), -1); };

async function contar(servicios, desde, hasta) {
  const grupos = await servicios.aggregate([
    { $match: { createdDate: { $gte: inicioColombia(desde), $lt: inicioColombia(sumarDias(hasta, 1)) } } },
    { $group: {
      _id: {
        fecha: { $dateToString: { format: '%Y-%m-%d', date: '$createdDate', timezone: 'America/Bogota' } },
        cliente: { $ifNull: ['$owner.name', ''] },
        tipo: { $ifNull: ['$type', ''] },
        estado: '$status',
      },
      n: { $sum: 1 },
    } },
  ]).toArray();
  return grupos.map((g) => ({
    fecha: g._id.fecha,
    cliente: String(g._id.cliente).trim(),
    tipo: String(g._id.tipo).trim(),
    estado: ESTADOS[g._id.estado] ?? (g._id.estado == null ? '' : 'Estado ' + g._id.estado),
    servicios: g.n,
  }));
}

async function enviar(desde, hasta, filas) {
  const r = await context.http.post({
    url: SUPABASE,
    headers: { apikey: [PUBLICABLE], 'Content-Type': ['application/json'] },
    body: JSON.stringify({ p_clave: context.values.get('claveTablero'), p_desde: desde, p_hasta: hasta, p_filas: filas }),
  });
  const texto = r.body ? r.body.text() : '';
  if (r.statusCode !== 200) throw new Error(`Supabase respondió ${r.statusCode} (${desde} a ${hasta}): ${texto.slice(0, 300)}`);
  return Number(texto);
}

exports = async function (desde, hasta) {
  // Cuando corre por horario, Atlas le pasa el evento del trigger como primer argumento: solo valen fechas en texto.
  const esFecha = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  hasta = esFecha(hasta) ? hasta : hoyColombia();
  desde = esFecha(desde) ? desde : sumarDias(hasta, -(DIAS - 1));
  const servicios = context.services.get('wipglobal-platform-prod').db('ServicesDB').collection('Service');
  const resumen = [];
  // Por meses, para que cada envío sea pequeño (el histórico desde 2023 son decenas de miles de filas).
  for (let ini = desde; ini <= hasta; ini = sumarDias(finDeMes(ini), 1)) {
    const fin = finDeMes(ini) < hasta ? finDeMes(ini) : hasta;
    const filas = await contar(servicios, ini, fin);
    const cargadas = await enviar(ini, fin, filas);
    resumen.push(`${ini}..${fin}: ${filas.reduce((a, f) => a + f.servicios, 0)} servicios en ${cargadas} filas`);
  }
  console.log(resumen.join('\n'));
  return resumen;
};
