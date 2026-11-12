import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portfolio Base - Cimientos Reservas Multiempresa',
  description: 'Arquitectura base para sistema multiempresa de reservas y recordatorios para pymes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
