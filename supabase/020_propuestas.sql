-- Página "Links de interés" del tablero (2026-10-07): pestaña Accionadores (tabla accionadores) y pestaña Propuestas
-- con los enlaces de las propuestas, informes y documentos que se han enviado a clientes (páginas privadas de
-- wiptool.com, con noindex). La lista la edita el equipo desde el tablero.
create table if not exists propuestas (
  id              bigint generated always as identity primary key,
  cliente         text not null,
  documento       text not null,
  tipo            text not null default 'Propuesta comercial',
  enlace          text not null default '',
  fecha           date,
  notas           text not null default '',
  actualizado_por text not null default '',
  actualizado     timestamptz not null default now()
);
alter table propuestas enable row level security;
drop policy if exists solo_equipo on propuestas;
create policy solo_equipo on propuestas for select to authenticated using (es_equipo_wip());
drop policy if exists equipo_edita on propuestas;
create policy equipo_edita on propuestas for all to authenticated using (es_equipo_wip()) with check (es_equipo_wip());
revoke all on propuestas from anon;

-- Lista inicial: las páginas privadas que hay hoy en landing-wip (fecha = cuando se publicó la página).
insert into propuestas (cliente, documento, tipo, enlace, fecha, actualizado_por)
select v.cliente, v.documento, v.tipo, v.enlace, v.fecha::date, 'carga inicial' from (values
  ('Asisya', 'Propuesta Asisya', 'Propuesta comercial', 'https://www.wiptool.com/cotizaciones/asisya01', '2026-08-28'),
  ('Auxilia', 'Propuesta integral Auxilia', 'Propuesta comercial', 'https://www.wiptool.com/cotizaciones/auxilia01', '2026-08-30'),
  ('Sotrandes', 'Propuesta Sotrandes', 'Propuesta comercial', 'https://www.wiptool.com/cotizaciones/sotrandes01', '2026-09-04'),
  ('Hisercol', 'Propuesta Hisercol', 'Propuesta comercial', 'https://www.wiptool.com/cotizaciones/Hisercol01', '2026-09-08'),
  ('Miguel Bustamante', 'Field Service Management para logísticas de asistencia', 'Propuesta comercial', 'https://www.wiptool.com/cotizaciones/MiguelBustamante', '2026-09-25'),
  ('Fixit', 'Informe semestral · WIP IA', 'Informe', 'https://www.wiptool.com/informeFixit/WipIA', '2026-09-10'),
  ('Avise Asistencia', 'Informe semestral · WIP IA', 'Informe', 'https://www.wiptool.com/informeWip/AviseAsistencia', '2026-09-11'),
  ('Inversionistas', 'One pager de inversión', 'Inversión', 'https://www.wiptool.com/inversion/onepager', '2026-09-08')
) as v(cliente, documento, tipo, enlace, fecha)
where not exists (select 1 from propuestas p where p.enlace = v.enlace);
