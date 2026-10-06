-- Plantillas de WhatsApp aprobadas por Meta (2026-10-06): pasadas las 24 h de la ventana de WhatsApp solo se puede
-- escribir con plantilla. F12 las envía con los Salesbots de Kommo 16850 ("Retomar contacto WIP") y 16852
-- ("Recordatorio de reunión WIP") y deja registro aquí.

-- Nuevos tipos de mensaje del agente: plantilla (segundo seguimiento) y recordatorio (día de la reunión).
alter table agente_mensajes drop constraint if exists agente_mensajes_tipo_check;
alter table agente_mensajes add constraint agente_mensajes_tipo_check
  check (tipo in ('normal', 'seguimiento', 'sin_seguimiento', 'plantilla', 'recordatorio'));

-- Segundo seguimiento: el primer seguimiento salió hace entre 2 y 5 días, la persona no respondió después y aún no se
-- le mandó la plantilla. La etapa, las etiquetas y si escribió alguien del equipo se revisan en n8n contra Kommo.
create or replace view agente_plantilla_pendiente with (security_invoker = true) as
with u as (
  select lead_id,
         max(momento) filter (where rol = 'cliente') as ult_cliente,
         max(momento) filter (where rol = 'agente' and tipo = 'seguimiento') as ult_seguimiento,
         max(momento) filter (where rol = 'agente' and tipo = 'plantilla') as ult_plantilla
    from agente_mensajes
   where momento > now() - interval '30 days'
   group by lead_id
)
select lead_id, ult_seguimiento
  from u
 where ult_seguimiento between now() - interval '5 days' and now() - interval '2 days'
   and (ult_cliente is null or ult_cliente < ult_seguimiento)
   and ult_plantilla is null;
revoke all on agente_plantilla_pendiente from anon, authenticated;

-- Recordatorio de reunión: cuándo se le recordó la cita a la persona (una vez por cita).
alter table calendly_kommo add column if not exists recordatorio timestamptz;
