import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Configuración de Vitest para NestJS en modo ESM
// Explicación técnica: NestJS requiere 'emitDecoratorMetadata' para resolver tokens
// de inyección de dependencias en tiempo de ejecución. El plugin SWC procesa los decoradores
// de TypeScript a alta velocidad manteniendo compatibilidad total.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
});
