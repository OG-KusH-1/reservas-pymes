import './globals.css';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';

export const metadata: Metadata = {
  // Cada página define solo su título; la plantilla agrega el nombre del producto.
  title: { default: 'Agenda — Reservas en línea para tu negocio', template: '%s · Agenda' },
  description:
    'Publica tu agenda, recibe reservas en línea las 24 horas y reduce las inasistencias con recordatorios automáticos.',
  applicationName: 'Agenda',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

/**
 * Layout raíz: envuelve todas las rutas. Aquí solo va lo verdaderamente
 * global (idioma, tipografías, proveedores). La estructura visual de cada
 * área está en el layout de su grupo de rutas.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning`: next-themes agrega la clase `dark` al <html>
    // antes de que React hidrate, para evitar un destello de tema incorrecto.
    <html
      lang="es"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
