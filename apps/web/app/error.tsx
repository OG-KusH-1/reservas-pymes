'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Límite de error global: se muestra cuando una página falla al renderizar.
 * Debe ser un componente cliente (requisito de Next).
 *
 * `digest` es el identificador que Next asigna al error en el servidor; se
 * muestra para que la persona pueda citarlo al pedir ayuda y ubicarlo en los
 * registros. El detalle del error no se muestra nunca.
 */
export default function ErrorGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Algo salió mal</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Ocurrió un error inesperado. Puedes intentarlo nuevamente.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground font-mono text-xs">Referencia: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}
