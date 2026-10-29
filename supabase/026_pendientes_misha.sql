-- Pendientes Misha (2026-10-29): página de Operaciones con los correos de Gmail que le piden algo a Misha, resumidos
-- por Claude. Claude agrega una fila por correo (correo_id es único: con "on conflict (correo_id) do nothing" un correo
-- no se duplica) y deja su respuesta. Desde el tablero, Misha marca cada uno como hecho o descartado, o con "Tomar
-- acción" le escribe a Claude qué hacer (estado 'accion' e instruccion_atendida = false hasta que Claude responda).
create table if not exists pendientes_misha (
  id                   bigint generated always as identity primary key,
  titulo               text not null,
  resumen              text not null default '',
  remitente            text not null default '',
  correo_url           text not null default '',
  correo_id            text not null unique,
  fecha_correo         timestamptz,
  prioridad            text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  estado               text not null default 'nuevo' check (estado in ('nuevo', 'hecho', 'descartado', 'accion')),
  instruccion          text not null default '',
  respuesta            text not null default '',
  instruccion_atendida boolean not null default false,
  creado               timestamptz not null default now(),
  actualizado          timestamptz not null default now()
);
alter table pendientes_misha enable row level security;
drop policy if exists solo_equipo on pendientes_misha;
create policy solo_equipo on pendientes_misha for select to authenticated using (es_equipo_wip());
drop policy if exists equipo_edita on pendientes_misha;
create policy equipo_edita on pendientes_misha for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip());
revoke all on pendientes_misha from anon;

-- La tabla la editan dos lados (el tablero y Claude, con la clave de servicio): "actualizado" se pone solo en cada cambio.
create or replace function pendientes_misha_actualizado() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.actualizado := now();
  return new;
end $$;
drop trigger if exists pendientes_misha_actualizado on pendientes_misha;
create trigger pendientes_misha_actualizado before update on pendientes_misha
  for each row execute function pendientes_misha_actualizado();
