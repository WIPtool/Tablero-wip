// n8n · F12 · asunto e invitación de las demos de Calendly (antes F20, cada 5 minutos). armar-flujo.cjs toma cada parte por su marca "// ==".
// Calendly gratis pone de asunto "Nombre y Meli de Wip" y no deja cambiarlo. Cada hora (en la corrida de F12) lee las demos que vienen
// en el calendario de comercial@ (las que creó Calendly), les pone el asunto de WIP y agrega a Jessica como invitada.
// Se guarda con sendUpdates=none: el cliente no recibe correo, pero el asunto nuevo se ve en su calendario y en el de Jessica.

// == Demos por ajustar (Code, una vez para todos los elementos)
const ASUNTO = 'Acercamiento Wip - Software para gestión de tus servicios';
const INVITADA = 'jessica@wiptool.com';
const salida = [];
for (const ev of ($input.first().json.items || [])) {
  if (ev.status === 'cancelled' || !/calendly\.com/i.test(ev.description || '')) continue;
  const invitados = ev.attendees || [];
  const falta = !invitados.some((p) => String(p.email || '').toLowerCase() === INVITADA);
  if (ev.summary === ASUNTO && !falta) continue;
  salida.push({ json: { id: ev.id, antes: ev.summary,
    cuerpo: { summary: ASUNTO, ...(falta ? { attendees: [...invitados, { email: INVITADA }] } : {}) } } });
}
return salida;
