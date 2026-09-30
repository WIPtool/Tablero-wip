import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const inter = localFont({
  src: [
    { path: './fonts/inter-latin.woff2', weight: '300 700', style: 'normal' },
    { path: './fonts/inter-latin-ext.woff2', weight: '300 700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
});

const satoshi = localFont({
  src: [
    { path: './fonts/satoshi-500.woff2', weight: '500' },
    { path: './fonts/satoshi-700.woff2', weight: '700' },
    { path: './fonts/satoshi-900.woff2', weight: '900' },
  ],
  variable: '--font-satoshi',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Tablero WIP', template: '%s · Tablero WIP' },
  robots: { index: false, follow: false },
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Fija el tema antes de pintar (preferencia guardada o la del sistema), para que no parpadee.
const TEMA = `try{var t=localStorage.getItem('tablero_tema');if(t!=='dark'&&t!=='light')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${satoshi.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
