-- F7 · agente de WhatsApp: historial de cada conversación (lo escribe y lo lee n8n con la clave de servicio).
-- Kommo no entrega el texto de los mensajes por su API, así que el agente guarda aquí lo que llega por el webhook
-- y lo que responde, para darle a Claude el contexto de la conversación.
create table if not exists agente_mensajes (
  id         bigint generated always as identity primary key,
  lead_id    bigint not null,
  rol        text not null check (rol in ('cliente', 'agente')),
  texto      text not null,
  mensaje_id text unique,                 -- id del mensaje en Kommo (solo los del cliente)
  talk_id    text,
  momento    timestamptz not null default now()
);
create index if not exists agente_mensajes_lead on agente_mensajes (lead_id, momento);
alter table agente_mensajes enable row level security;
drop policy if exists solo_equipo on agente_mensajes;
create policy solo_equipo on agente_mensajes for select to authenticated using (es_equipo_wip());
revoke all on agente_mensajes from anon;
