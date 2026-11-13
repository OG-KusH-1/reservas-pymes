'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

/**
 * Alterna entre tema claro y oscuro.
 *
 * Los dos iconos se renderizan siempre y se muestran u ocultan con CSS según
 * la clase `dark` del documento. Así el HTML del servidor coincide con el del
 * cliente y no hay que esperar al montaje para saber el tema activo.
 */
export function SelectorTema() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Cambiar entre tema claro y oscuro"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="dark:hidden" aria-hidden />
      <Moon className="hidden dark:block" aria-hidden />
    </Button>
  );
}
