-- F2 · Calendly → Kommo: qué citas de Calendly ya pasaron a Kommo (los escribe n8n con la clave de servicio).
create table if not exists calendly_kommo (
  clave             text primary key,          -- invitado de Calendly (uri)
  evento            text not null,             -- cita de Calendly (uri)
  kommo_lead_id     bigint,
  kommo_contacto_id bigint,
  accion            text not null,             -- creado | movida (pasó a Reunión agendada) | existente (solo nota)
  momento           timestamptz not null default now()
);
create index if not exists calendly_kommo_evento on calendly_kommo (evento);
alter table calendly_kommo enable row level security;
drop policy if exists solo_equipo on calendly_kommo;
create policy solo_equipo on calendly_kommo for select to authenticated using (es_equipo_wip());
revoke all on calendly_kommo from anon;
