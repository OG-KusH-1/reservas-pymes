import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RUTAS } from '@/lib/rutas';

/** Página 404 de toda la aplicación. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">No encontramos esta página</h1>
      <p className="text-muted-foreground max-w-sm text-sm">
        Puede que el enlace esté incompleto o que la página ya no exista.
      </p>
      <Button asChild>
        <Link href={RUTAS.inicio}>Volver al inicio</Link>
      </Button>
    </main>
  );
}
