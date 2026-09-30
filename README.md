# Tablero WIP

Tablero de marketing propio de WIP, en `tablero.wiptool.com`. Reemplaza a Data Studio y a Windsor.ai.

- **Tecnología:** Next.js 16 (App Router) + Tailwind CSS 4 + Supabase (@supabase/ssr).
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
- `src/proxy.ts`: antes de cada página renueva la sesión y manda a `/entrar` a quien no tenga cuenta @wiptool.com.
- `src/app/(tablero)/`: páginas (componentes de servidor que piden los datos con la sesión de la persona). El periodo va en la dirección: `?p=7|28|90|mes|mes_ant` u `?p=otro&desde=AAAA-MM-DD&hasta=AAAA-MM-DD`.
- `src/componentes/`: gráficas en SVG propio y tablas ordenables (componentes de cliente), cifras y tarjetas.
- `src/app/globals.css`: colores de WIP como tema de Tailwind 4 (claro y oscuro con `data-theme`).

## Desarrollo

```
npm install
npm run dev
```

Abre http://localhost:5174 y entra con Google. Para ver el **modo de ejemplo** (cifras inventadas, sin iniciar sesión) arranca con `TABLERO_DEMO=1 npm run dev`.

## Puesta en marcha (una sola vez)

1. **Supabase:** proyecto `tablero-wip` en East US. En el editor SQL, correr `001_esquema.sql` y luego `002_funciones.sql`.
2. **Google Cloud (misha@wiptool.com):** proyecto `tablero-wip` con:
   - la API de datos de Google Analytics y la API de Search Console activadas;
   - un cliente OAuth "n8n (carga del tablero)" con retorno `https://oauth.n8n.cloud/oauth2/callback`, para que n8n lea con la cuenta de misha (credencial Google OAuth2 API con scopes analytics.readonly y webmasters.readonly);
   - un cliente OAuth (aplicación web) con la URL de retorno `https://<proyecto>.supabase.co/auth/v1/callback`, que se pega en Supabase > Authentication > Providers > Google.
3. **Supabase > Authentication > URL Configuration:** Site URL `https://tablero.wiptool.com` y Redirect URLs `https://tablero.wiptool.com/**` y `http://localhost:5174/**` (el retorno de Google es `/auth/callback`).
4. **Vercel** (cuenta del sitio, equipo mikfobe-3309s-projects): proyecto `tablero-wip` desde este repositorio y dominio `tablero.wiptool.com` (registro CNAME en Route 53).
5. **n8n** (wiptool.app.n8n.cloud): importar `n8n/f12-carga-tablero.json` (se arma con `node n8n/armar-flujo.cjs`), asignar la credencial de Google y una Header Auth `apikey` con la clave secreta de Supabase, y correr una vez el disparador manual para cargar el histórico.
