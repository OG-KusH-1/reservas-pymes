'use client';

import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MenuUsuario } from './menu-usuario';
import { ETIQUETAS_ROL, NavegacionMovil } from './navegacion-panel';
import { useSesionPanel } from './proveedor-sesion';

/**
 * Cabecera superior del panel interno.
 *
 * En móvil muestra el disparador del menú lateral (`Sheet`), el nombre de la
 * empresa activa y el menú de usuario. En escritorio acompaña a la barra
 * lateral con el contexto de empresa, rol y cuenta.
 */
export function CabeceraPanel() {
  const sesion = useSesionPanel();

  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
      <div className="flex min-w-0 items-center gap-2">
        <NavegacionMovil rol={sesion.rol} />
        <div className="flex min-w-0 items-center gap-2">
          <Building2
            className="text-muted-foreground hidden size-4 shrink-0 sm:block"
            aria-hidden
          />
          <span className="truncate text-sm font-semibold">{sesion.empresa.nombre}</span>
          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
            {ETIQUETAS_ROL[sesion.rol]}
          </Badge>
        </div>
      </div>

      <MenuUsuario />
    </header>
  );
}
