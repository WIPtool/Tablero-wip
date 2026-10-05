-- F4 · Explee → Kommo: qué leads calientes de Explee ya pasaron a Kommo (los escribe n8n con la clave de servicio).
create table if not exists explee_kommo (
  lead_id           text primary key,          -- id del lead caliente en Explee (explee_lead.lead_id)
  kommo_lead_id     bigint,                    -- oportunidad en Kommo (la creada o la que ya existía)
  kommo_contacto_id bigint,
  accion            text not null,             -- creado | existente (ya estaba en Kommo: solo se dejó la nota)
  momento           timestamptz not null default now()
);
alter table explee_kommo enable row level security;
drop policy if exists solo_equipo on explee_kommo;
create policy solo_equipo on explee_kommo for select to authenticated using (es_equipo_wip());
revoke all on explee_kommo from anon;
