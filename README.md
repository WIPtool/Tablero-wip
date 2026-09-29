# Tablero WIP

Tablero de marketing propio de WIP, en `tablero.wiptool.com`. Reemplaza a Data Studio y a Windsor.ai.

- **Qué muestra (T1):** Resumen, Sitio web, SEO sitio web y SEO plataforma, con los datos de Google Analytics 4 y Search Console.
- **Por qué es rápido:** no consulta a Google cada vez. Un flujo de n8n (F12) guarda cada hora las cifras por día en Supabase, y el tablero lee cifras ya agregadas.
- **Quién entra:** solo cuentas de Google `@wiptool.com`. La base de datos rechaza cualquier otra cuenta (reglas de seguridad en `supabase/001_esquema.sql`).
- **Qué guarda:** solo números por día, campaña y origen. Nada de nombres, correos ni teléfonos.

## Cómo funciona

```
Google Analytics 4 ─┐
Search Console ─────┼─> n8n (F12, cada hora) ─> Supabase (Postgres) ─> este tablero (Vercel)
(T2: Meta, Google Ads, Brevo, Explee, Kommo)          ▲                     │
                                                      └── acceso con Google @wiptool.com
```

- `supabase/001_esquema.sql`: tablas, reglas de seguridad y la función `cargar()` que usa n8n.
- `supabase/002_funciones.sql`: una función por página (`tablero_resumen`, `tablero_sitio`, `tablero_seo`, `tablero_estado`).
- `src/`: el tablero (Vite, JavaScript sin framework, gráficas en SVG propio).

## Desarrollo

```
npm install
npm run dev
```

Sin `.env` arranca en **modo de ejemplo**, con cifras inventadas. Para ver datos reales, copia `.env.example` a `.env` y llena la URL y la clave pública (anon) del proyecto de Supabase.

## Puesta en marcha (una sola vez)

1. **Supabase:** proyecto `tablero-wip` en East US. En el editor SQL, correr `001_esquema.sql` y luego `002_funciones.sql`.
2. **Google Cloud (misha@wiptool.com):** proyecto `tablero-wip` con:
   - la API de datos de Google Analytics y la API de Search Console activadas;
   - una cuenta de servicio `tablero-carga`, agregada como lectora en la propiedad de Analytics y como usuaria en Search Console;
   - un cliente OAuth (aplicación web) con la URL de retorno `https://<proyecto>.supabase.co/auth/v1/callback`, que se pega en Supabase > Authentication > Providers > Google.
3. **Supabase > Authentication > URL Configuration:** Site URL `https://tablero.wiptool.com`, y en Redirect URLs también `http://localhost:5174`.
4. **Vercel:** proyecto nuevo desde este repositorio, con las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y el dominio `tablero.wiptool.com` (un registro CNAME en Route 53 hacia Vercel).
5. **n8n:** flujo F12 con la cuenta de servicio de Google y la clave de servicio de Supabase (nunca en el navegador ni en este repositorio).
