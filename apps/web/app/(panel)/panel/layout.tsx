import type { Metadata } from 'next';
import { Marca } from '@/components/layout/marca';
import { SelectorTema } from '@/components/layout/selector-tema';
import { RUTAS } from '@/lib/rutas';

export const metadata: Metadata = {
  // El panel es privado: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

/**
 * Layout del panel interno de una empresa.
 *
 * Por ahora es solo el marco (cabecera y área de contenido). La tarea T14
 * agrega la navegación lateral, el menú de usuario y la protección de rutas:
 * este layout debe verificar la sesión en el servidor y redirigir a
 * `/ingresar` si no existe.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <Marca href={RUTAS.panel.inicio} />
        <SelectorTema />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
