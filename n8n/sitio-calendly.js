// n8n · F1 (formularios del sitio → Kommo) y F2 (citas de Calendly → Kommo). armar-flujo.cjs toma cada parte por su marca "// ==".
// Cada parte deja los datos en la forma que espera kommo-crear.js. Origen: el que trae la visita (wipOrigen del sitio o utm_source).

// == Lead del formulario (Code, una vez para todos los elementos)
// Llega de /api/contact del sitio (portada, equipos y /contacto) después de enviar el correo.
const BASE = 'https://wiptool.kommo.com/api/v4';
const ORIGEN = { instagram: 340194, ig: 340194, facebook: 340196, fb: 340196, meta_ads: 340198, explee: 340200, email: 340202, brevo: 340202,
  sendinblue: 340202, sitio_web: 340204, google: 340206, linkedin: 340208 };
const LIBRES = /^(gmail|hotmail|outlook|live|yahoo|icloud|msn|aol|protonmail)\./i;
const digitos = (t) => String(t || '').replace(/\D/g, '').slice(-10);
const buscar = (q) => `${BASE}/contacts?with=leads&query=${encodeURIComponent(q)}`;
return $input.all().map((i) => i.json.body || i.json).filter((d) => d && d.email).map((d) => {
  const correo = String(d.email).trim().toLowerCase();
  const dom = correo.split('@')[1] || '';
  const origen = String(d.origen || d.utm_source || '').toLowerCase();
  const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].filter((k) => d[k]).map((k) => `${k}=${d[k]}`).join(' · ');
  const nota = [
    'Formulario de contacto del sitio',
    d.pagina ? `Página: ${d.pagina}` : '',
    `Empresa: ${d.empresa || '—'}`,
    d.telefono ? `Teléfono: ${d.telefono}` : '',
    d.servicios ? `Servicios mensuales: ${d.servicios}` : '',
    d.necesidad ? `Necesidad: ${d.necesidad}` : '',
    `Origen de la visita: ${origen || 'sitio web'}${utm ? ' (' + utm + ')' : ''}`,
  ].filter(Boolean).join('\n');
  return { json: {
    clave: `formulario|${correo}|${Date.now()}`, nombre: d.nombre || '', correo, telefono: d.telefono || '', empresa: d.empresa || '',
    dominio: LIBRES.test(dom) ? '' : dom, cargo: '', origen: ORIGEN[origen] || ORIGEN.sitio_web, campana: d.utm_campaign || 'Formulario de contacto',
    objetivo: 'nuevo', etiqueta: 'Formulario web', nota,
    url_correo: buscar(correo), url_telefono: buscar(digitos(d.telefono) || correo),
  } };
});

// == Pedidos Calendly (Code, una vez para todos los elementos)
// Con el usuario de Calendly pide sus citas activas desde hace 2 días (las nuevas siempre son de hoy en adelante).
const usuario = ($input.first().json.resource || {}).uri;
if (!usuario) throw new Error('Calendly no devolvió el usuario: ' + JSON.stringify($input.first().json).slice(0, 200));
const desde = new Date(Date.now() - 2 * 86400000).toISOString();
return [{ json: { url: `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(usuario)}&status=active&count=100&sort=start_time:asc&min_start_time=${encodeURIComponent(desde)}` } }];

// == Citas nuevas (Calendly) (Code, una vez para todos los elementos)
// Deja solo las citas que aún no pasaron a Kommo (tabla calendly_kommo) y pide sus invitados.
const r = $('Citas Calendly').first().json;
if (r.pagination && r.pagination.next_page) throw new Error('Calendly tiene más de 100 citas activas en el periodo: hay que paginar "Citas Calendly"');
const hechas = new Set($input.all().map((i) => i.json.evento).filter(Boolean));
return (r.collection || []).filter((ev) => !hechas.has(ev.uri)).map((ev) => ({ json: {
  url: `${ev.uri}/invitees?count=100`, evento: ev.uri, nombre_evento: ev.name || '', inicio: ev.start_time,
  enlace: (ev.location && (ev.location.join_url || ev.location.location)) || '',
} }));

// == Lead de la cita (Calendly) (Code, una vez para todos los elementos)
// Un elemento por invitado activo, con su origen tomado del utm_source con que llegó a Calendly.
const BASE = 'https://wiptool.kommo.com/api/v4';
const ORIGEN = { instagram: 340194, ig: 340194, facebook: 340196, fb: 340196, meta_ads: 340198, explee: 340200, email: 340202, brevo: 340202,
  sendinblue: 340202, sitio_web: 340204, google: 340206, linkedin: 340208 };
const LIBRES = /^(gmail|hotmail|outlook|live|yahoo|icloud|msn|aol|protonmail)\./i;
const citas = $('Citas nuevas (Calendly)').all();
const respuestas = $input.all();
const hora = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' });
const dia = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' });
const digitos = (t) => String(t || '').replace(/\D/g, '').slice(-10);
const buscar = (q) => `${BASE}/contacts?with=leads&query=${encodeURIComponent(q)}`;
const salida = [];
respuestas.forEach((resp, i) => {
  const c = citas[i].json;
  for (const inv of resp.json.collection || []) {
    if (inv.status && inv.status !== 'active') continue;
    const qa = inv.questions_and_answers || [];
    const respuesta = (re) => (qa.find((x) => re.test(x.question || '')) || {}).answer || '';
    const correo = String(inv.email || '').trim().toLowerCase();
    const dom = correo.split('@')[1] || '';
    const telefono = respuesta(/tel[eé]f|whats|celular|m[oó]vil|phone/i) || inv.text_reminder_number || '';
    const t = inv.tracking || {};
    const origen = String(t.utm_source || '').toLowerCase();
    // El agente de WhatsApp manda el enlace con utm_content=kommo-<id de la oportunidad>: se usa esa oportunidad directamente.
    const directo = /^kommo-(\d+)$/.exec(String(t.utm_content || ''));
    const nota = [
      `Reunión agendada en Calendly: ${c.nombre_evento}`,
      `Fecha de la reunión: ${c.inicio ? hora.format(new Date(c.inicio)) : '—'}`,
      c.enlace ? `Enlace: ${c.enlace}` : '',
      `Origen: ${origen || 'sin utm_source'}${t.utm_campaign ? ' · campaña ' + t.utm_campaign : ''}${t.utm_content ? ' · ' + t.utm_content : ''}`,
      ...qa.filter((x) => x.answer).map((x) => `${x.question}: ${x.answer}`),
    ].filter(Boolean).join('\n');
    salida.push({ json: {
      clave: inv.uri, evento: c.evento, kommo_lead: directo ? Number(directo[1]) : null, nombre: inv.name || '', correo, telefono,
      empresa: respuesta(/empresa|compa[ñn][ií]a|company|organizaci/i), dominio: LIBRES.test(dom) ? '' : dom, cargo: respuesta(/cargo|puesto|rol\b|job|title/i),
      origen: ORIGEN[origen] || ORIGEN.sitio_web, campana: t.utm_campaign || 'Reunión en Calendly', objetivo: 'reunion',
      fecha: inv.created_at ? dia.format(new Date(inv.created_at)) : '', etiqueta: 'Calendly', nota,
      url_correo: buscar(correo || digitos(telefono)), url_telefono: buscar(digitos(telefono) || correo),
    } });
  }
});
return salida;

// == Registro Calendly-Kommo (Code, una vez para todos los elementos)
const leads = $('Lead de la cita (Calendly)').all();
return [{ json: { filas: $('Nota en Kommo (armar) (Calendly)').all().map((n, i) => ({ ...n.json.fila, evento: leads[i].json.evento })) } }];
