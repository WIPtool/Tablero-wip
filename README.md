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

Se conecta al proyecto de Supabase `tablero-wip` (la dirección y la clave publicable están en `src/datos.js`). Para ver el **modo de ejemplo**, con cifras inventadas, abre `http://localhost:5174/?demo`.

## Puesta en marcha (una sola vez)

1. **Supabase:** proyecto `tablero-wip` en East US. En el editor SQL, correr `001_esquema.sql` y luego `002_funciones.sql`.
2. **Google Cloud (misha@wiptool.com):** proyecto `tablero-wip` con:
   - la API de datos de Google Analytics y la API de Search Console activadas;
   - un cliente OAuth "n8n (carga del tablero)" con retorno `https://oauth.n8n.cloud/oauth2/callback`, para que n8n lea con la cuenta de misha (credencial Google OAuth2 API con scopes analytics.readonly y webmasters.readonly);
   - un cliente OAuth (aplicación web) con la URL de retorno `https://<proyecto>.supabase.co/auth/v1/callback`, que se pega en Supabase > Authentication > Providers > Google.
3. **Supabase > Authentication > URL Configuration:** Site URL `https://tablero.wiptool.com`, y en Redirect URLs también `http://localhost:5174`.
4. **Vercel** (cuenta del sitio, equipo mikfobe-3309s-projects): proyecto `tablero-wip` desde este repositorio y dominio `tablero.wiptool.com` (registro CNAME en Route 53).
5. **n8n** (wiptool.app.n8n.cloud): importar `n8n/f12-carga-tablero.json` (se arma con `node n8n/armar-flujo.cjs`), asignar la credencial de Google y una Header Auth `apikey` con la clave secreta de Supabase, y correr una vez el disparador manual para cargar el histórico.
