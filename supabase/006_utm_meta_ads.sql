-- Los anuncios de Meta (clic a WhatsApp) llevan desde el 2026-10-05 los parámetros
-- utm_source=meta_ads&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{site_source_name}},
-- y Kommo los guarda en los datos de seguimiento del lead. Si el campo "Origen" quedó vacío, el chat cuenta como Meta Ads.
create or replace function origen_kommo(p_origen text, p_utm text) returns text
language sql immutable as $$
  select case
    when coalesce(p_origen, '') <> '' then p_origen
    when lower(p_utm) like '%explee%' then 'Explee'
    when lower(p_utm) in ('meta_ads', 'meta', 'facebook_ads', 'fb_ads') then 'Meta Ads'
    when lower(p_utm) in ('instagram', 'ig') then 'Instagram'
    when lower(p_utm) in ('facebook', 'fb') then 'Facebook'
    when lower(p_utm) in ('brevo', 'sendinblue', 'email') then 'Correo (Brevo)'
    when lower(p_utm) = 'google' then 'Google Ads'
    when lower(p_utm) = 'linkedin' then 'LinkedIn'
    else 'Sin origen'
  end
$$;
