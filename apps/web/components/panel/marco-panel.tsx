'use client';

import { CabeceraPanel } from './cabecera-panel';
import { BarraLateralPanel } from './navegacion-panel';
import { useSesionPanel } from './proveedor-sesion';

/**
 * Armazón visual del panel interno: barra lateral colapsable en escritorio,
 * cabecera superior con menú móvil y de usuario, y área principal de contenido.
 */
export function MarcoPanel({ children }: { children: React.ReactNode }) {
  const sesion = useSesionPanel();

  return (
    <div className="flex min-h-dvh">
      <BarraLateralPanel rol={sesion.rol} />
      <div className="flex min-w-0 flex-1 flex-col">
        <CabeceraPanel />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
