-- Agenda medida por plataforma para el agente de WhatsApp (2026-10-06): /agenda-ig, /agenda-fb y /agenda-meta registran
-- el clic a la agenda en Analytics con su origen y pasan a Calendly con UTM (api/agenda.js de landing-wip). El agente
-- agrega ?c=kommo-<id> para que la cita mueva esa oportunidad. Explee y correo ya tenían /agenda-explee y /agenda-email.
insert into accionadores (plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa, actualizado_por)
select v.*, 'agente de WhatsApp' from (values
  ('Instagram', 'Enlace medido', 'Agenda desde Instagram', 'https://www.wiptool.com/agenda-ig',
   'Registra el clic a la agenda (click_calendly, origen instagram) y lleva a Calendly con fuente instagram, medio social, campaña whatsapp. Con ?c=… pasa ese dato como contenido (el agente usa ?c=kommo-<id>).',
   'Resumen › Clics a WhatsApp y a la agenda por origen; la cita, en Citas agendadas por origen.', 'Agente de WhatsApp con personas que llegaron por Instagram'),
  ('Facebook', 'Enlace medido', 'Agenda desde Facebook', 'https://www.wiptool.com/agenda-fb',
   'Registra el clic a la agenda (click_calendly, origen facebook) y lleva a Calendly con fuente facebook, medio social, campaña whatsapp. Con ?c=… pasa ese dato como contenido (el agente usa ?c=kommo-<id>).',
   'Resumen › Clics a WhatsApp y a la agenda por origen; la cita, en Citas agendadas por origen.', 'Agente de WhatsApp con personas que llegaron por Facebook'),
  ('Meta Ads', 'Enlace medido', 'Agenda desde anuncios de Meta', 'https://www.wiptool.com/agenda-meta',
   'Registra el clic a la agenda (click_calendly, origen meta_ads) y lleva a Calendly con fuente meta_ads, medio paid_social, campaña whatsapp. Con ?c=… pasa ese dato como contenido (el agente usa ?c=kommo-<id>).',
   'Resumen › Clics a WhatsApp y a la agenda por origen; la cita, en Citas agendadas por origen.', 'Agente de WhatsApp con personas que llegaron por un anuncio de Meta')
) as v(plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa)
where not exists (select 1 from accionadores a where a.enlace = v.enlace);
