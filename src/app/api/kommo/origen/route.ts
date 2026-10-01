import { after } from 'next/server';

// Webhook de Kommo "Mensaje entrante recibido": llena el campo Origen de la oportunidad según lo que dice
// el primer mensaje de WhatsApp. Los botones y enlaces del sitio escriben de dónde viene la persona
// ("Hola, vengo de Instagram…"). Solo se llena si la oportunidad aún no tiene Origen (no pisa lo que puso el equipo).
// Variables en Vercel: KOMMO_TOKEN (token de larga duración de la integración "Tablero WIP (n8n)")
// y KOMMO_WEBHOOK_CLAVE (va en la dirección del webhook: ?clave=…).
const KOMMO = 'https://wiptool.kommo.com/api/v4';
const CAMPO_ORIGEN = 421634;
const REGLAS: [RegExp, number][] = [
  [/vengo de instagram/, 340194], // Instagram
  [/vengo de facebook/, 340196], // Facebook
  [/vengo del correo de wip/, 340202], // Correo (Brevo)
  [/vengo del correo que me enviaron/, 340200], // Explee
  [/vengo del sitio web/, 340204], // Sitio web
];

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

async function kommo(ruta: string, init: RequestInit = {}) {
  return fetch(`${KOMMO}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.KOMMO_TOKEN}`, 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
}

async function asignarOrigen(lead: string, opcion: number) {
  const r = await kommo(`/leads/${lead}`);
  if (!r.ok) return console.error('Kommo: no se pudo leer la oportunidad', lead, r.status);
  const datos = (await r.json()) as { custom_fields_values?: { field_id: number }[] | null };
  if ((datos.custom_fields_values ?? []).some((c) => c.field_id === CAMPO_ORIGEN)) return; // ya tiene Origen
  const p = await kommo(`/leads/${lead}`, {
    method: 'PATCH',
    body: JSON.stringify({ custom_fields_values: [{ field_id: CAMPO_ORIGEN, values: [{ enum_id: opcion }] }] }),
  });
  if (!p.ok) console.error('Kommo: no se pudo guardar el Origen', lead, p.status, await p.text());
}

export async function POST(request: Request) {
  const clave = process.env.KOMMO_WEBHOOK_CLAVE;
  if (!clave || new URL(request.url).searchParams.get('clave') !== clave || !process.env.KOMMO_TOKEN) {
    return new Response('No autorizado', { status: 403 });
  }

  // Kommo manda un formulario: message[add][0][text]=…&message[add][0][entity_id]=…
  const mensajes = new Map<string, Record<string, string>>();
  for (const [k, v] of (await request.formData()).entries()) {
    const m = k.match(/^message\[add\]\[(\d+)\]\[(\w+)\]$/);
    if (!m) continue;
    const o = mensajes.get(m[1]) ?? {};
    o[m[2]] = String(v);
    mensajes.set(m[1], o);
  }

  const tareas: [string, number][] = [];
  for (const m of mensajes.values()) {
    if (m.type && m.type !== 'incoming') continue;
    const esLead = /lead/.test(m.entity_type ?? '') || m.element_type === '2';
    const lead = esLead ? m.entity_id || m.element_id : '';
    const regla = REGLAS.find(([patron]) => patron.test(normalizar(m.text ?? '')));
    if (lead && regla) tareas.push([lead, regla[1]]);
  }

  // Kommo espera la respuesta en menos de 2 segundos: se contesta ya y se trabaja después.
  if (tareas.length) after(async () => { for (const [lead, opcion] of tareas) await asignarOrigen(lead, opcion); });
  return new Response('ok');
}
