import Link from 'next/link';
import { Marca } from '@/components/layout/marca';
import { SelectorTema } from '@/components/layout/selector-tema';
import { Button } from '@/components/ui/button';
import { RUTAS } from '@/lib/rutas';

/** Layout del sitio público de la plataforma: cabecera con accesos y pie. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Marca />
          <nav className="flex items-center gap-1" aria-label="Principal">
            <SelectorTema />
            <Button variant="ghost" asChild>
              <Link href={RUTAS.ingresar}>Ingresar</Link>
            </Button>
            <Button asChild>
              <Link href={RUTAS.registro}>Crear cuenta</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm">
          <p>© {new Date().getFullYear()} Agenda</p>
          <Link
            href={RUTAS.estado}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Estado del sistema
          </Link>
        </div>
      </footer>
    </div>
  );
}
