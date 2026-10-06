-- Enlaces del agente de WhatsApp más cortos y sin la palabra "agente" (2026-10-05): /a y /a/… con
-- utm_source=whatsapp, utm_medium=chat, utm_campaign=asesor. Los /agente/… siguen funcionando como respaldo.
update accionadores
   set enlace = replace(enlace, 'https://www.wiptool.com/agente', 'https://www.wiptool.com/a'),
       que_hace = replace(replace(replace(que_hace,
                    '(fuente whatsapp, medio agente, campaña agente_whatsapp)', '(fuente whatsapp, medio chat, campaña asesor)'),
                    '/agente/', '/a/'), 'como del agente', 'como del agente de WhatsApp'),
       donde_se_ve = replace(donde_se_ve, 'medio agente', 'medio chat'),
       actualizado_por = 'agente de WhatsApp',
       actualizado = now()
 where plataforma = 'WhatsApp (agente)';
update accionadores set que_hace = replace(que_hace, 'de WhatsApp de WhatsApp', 'de WhatsApp') where plataforma = 'WhatsApp (agente)';
