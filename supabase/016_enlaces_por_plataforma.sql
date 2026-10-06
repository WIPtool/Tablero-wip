-- Enlaces medidos por plataforma para el agente de WhatsApp (2026-10-05). El usuario prefirió medir de dónde viene la
-- persona (Instagram, Facebook, anuncios de Meta, Explee, correo) y no que la visita viene del agente: el agente le da a
-- cada persona los enlaces de su plataforma. Se quitan los enlaces /a/… del agente (014 y 015) y se agregan los que faltaban.
delete from accionadores where plataforma = 'WhatsApp (agente)';

insert into accionadores (plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa, actualizado_por)
select v.*, 'agente de WhatsApp' from (values
  ('Instagram', 'Enlace medido', 'Planes desde Instagram', 'https://www.wiptool.com/planes/ig',
   'Lleva a los planes de la página de equipos (#planes) marcando la visita como Instagram (fuente instagram, medio social, campaña bio, contenido planes).',
   'Resumen › De dónde llegan las visitas: Redes sociales.', 'Agente de WhatsApp con personas que llegaron por Instagram; también sirve en publicaciones'),
  ('Facebook', 'Enlace medido', 'Página de equipos desde Facebook', 'https://www.wiptool.com/equipos/fb',
   'Lleva a la página de equipos marcando la visita como Facebook (fuente facebook, medio social, campaña perfil_equipos).',
   'Resumen › De dónde llegan las visitas: Redes sociales.', 'Agente de WhatsApp con personas que llegaron por Facebook; también sirve en publicaciones'),
  ('Facebook', 'Enlace medido', 'Planes desde Facebook', 'https://www.wiptool.com/planes/fb',
   'Lleva a los planes de la página de equipos (#planes) marcando la visita como Facebook (fuente facebook, medio social, campaña perfil, contenido planes).',
   'Resumen › De dónde llegan las visitas: Redes sociales.', 'Agente de WhatsApp con personas que llegaron por Facebook'),
  ('Explee', 'Enlace medido', 'Planes desde Explee', 'https://www.wiptool.com/planes/explee',
   'Lleva a los planes de la página de equipos (#planes) marcando la visita como Explee (fuente explee, medio email, campaña prospeccion, contenido planes).',
   'Prospección › Visitas a la web desde Explee.', 'Agente de WhatsApp con personas que llegaron por Explee; también sirve en los correos'),
  ('Meta Ads', 'Enlace medido', 'Página web desde anuncios de Meta', 'https://www.wiptool.com/meta',
   'Lleva a la portada marcando la visita como anuncios de Meta (fuente meta_ads, medio paid_social, campaña whatsapp).',
   'Resumen › De dónde llegan las visitas: Redes sociales de pago.', 'Agente de WhatsApp con personas que llegaron por un anuncio de Meta'),
  ('Meta Ads', 'Enlace medido', 'Página de equipos desde anuncios de Meta', 'https://www.wiptool.com/equipos/meta',
   'Lleva a la página de equipos marcando la visita como anuncios de Meta (fuente meta_ads, medio paid_social, campaña whatsapp, contenido equipos).',
   'Resumen › De dónde llegan las visitas: Redes sociales de pago.', 'Agente de WhatsApp con personas que llegaron por un anuncio de Meta'),
  ('Meta Ads', 'Enlace medido', 'Planes desde anuncios de Meta', 'https://www.wiptool.com/planes/meta',
   'Lleva a los planes de la página de equipos (#planes) marcando la visita como anuncios de Meta (fuente meta_ads, medio paid_social, campaña whatsapp, contenido planes).',
   'Resumen › De dónde llegan las visitas: Redes sociales de pago.', 'Agente de WhatsApp con personas que llegaron por un anuncio de Meta'),
  ('Brevo', 'Enlace medido', 'Página web desde correos de Brevo', 'https://www.wiptool.com/email',
   'Lleva a la portada marcando la visita como correo de Brevo (fuente brevo, medio email, campaña secuencias).',
   'Email marketing › Visitas a la web desde los correos.', 'Agente de WhatsApp con personas que llegaron por un correo; también sirve en los correos'),
  ('Brevo', 'Enlace medido', 'Página de equipos desde correos de Brevo', 'https://www.wiptool.com/equipos/email',
   'Lleva a la página de equipos marcando la visita como correo de Brevo (fuente brevo, medio email, campaña secuencias, contenido equipos).',
   'Email marketing › Visitas a la web desde los correos.', 'Agente de WhatsApp con personas que llegaron por un correo; también sirve en los correos'),
  ('Brevo', 'Enlace medido', 'Planes desde correos de Brevo', 'https://www.wiptool.com/planes/email',
   'Lleva a los planes de la página de equipos (#planes) marcando la visita como correo de Brevo (fuente brevo, medio email, campaña secuencias, contenido planes).',
   'Email marketing › Visitas a la web desde los correos.', 'Agente de WhatsApp con personas que llegaron por un correo; también sirve en los correos')
) as v(plataforma, tipo, accionador, enlace, que_hace, donde_se_ve, donde_se_usa)
where not exists (select 1 from accionadores a where a.enlace = v.enlace);
