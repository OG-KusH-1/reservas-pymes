'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { crearQueryClient } from '@/lib/api/query-client';

/**
 * Proveedores de contexto de toda la aplicación (tema, datos remotos,
 * tooltips y avisos). Es un componente cliente; el layout raíz sigue siendo
 * de servidor.
 *
 * Para agregar un proveedor global, anídalo aquí. Si solo lo necesita un área
 * (por ejemplo, la sesión dentro del panel), ponlo en el layout de esa área.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // `useState` garantiza un `QueryClient` por pestaña del navegador y, en el
  // servidor, uno por petición: así la caché nunca se comparte entre usuarios.
  const [queryClient] = useState(crearQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors closeButton position="top-right" />
        {/* Solo se incluye en desarrollo; el paquete se excluye del build de producción. */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
