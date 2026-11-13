import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Pruebas unitarias y de componentes de la web.
 *
 * - `jsdom` simula el navegador para poder renderizar componentes con
 *   Testing Library.
 * - El alias `@` replica el de `tsconfig.json`.
 * - `server-only` se sustituye por un módulo vacío: en producción impide
 *   importar código de servidor desde el cliente, pero en las pruebas no hay
 *   esa frontera y el paquete real lanzaría un error.
 *
 * Las pruebas de extremo a extremo (carpeta `e2e/`) usan Playwright y no
 * pasan por esta configuración.
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'server-only': path.resolve(import.meta.dirname, 'test/vacio.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.spec.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
    css: false,
  },
});
