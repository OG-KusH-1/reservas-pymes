import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * Vitest para NestJS en módulos ES.
 *
 * Nest necesita los metadatos de decoradores (`emitDecoratorMetadata`) para
 * resolver la inyección de dependencias, y esbuild —el transformador por
 * defecto de Vitest— no los genera. Por eso se compila con SWC.
 *
 * Hay dos proyectos:
 *  - `unit`: archivos `*.spec.ts`. Rápidos, sin base de datos ni red.
 *    Se ejecutan con `pnpm test`.
 *  - `integration`: archivos `*.int-spec.ts`. Levantan un PostgreSQL real en
 *    un contenedor (ver `test/global-setup.ts`), por lo que requieren Docker.
 *    Se ejecutan con `pnpm test:int`.
 */
const plugins = [
  swc.vite({
    module: { type: 'es6' },
    jsc: {
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
      target: 'es2022',
    },
  }),
];

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['src/**/*.spec.ts'],
          // Las pruebas unitarias no dependen del archivo .env del desarrollador.
          env: { NODE_ENV: 'test' },
        },
      },
      {
        plugins,
        test: {
          name: 'integration',
          globals: true,
          environment: 'node',
          include: ['src/**/*.int-spec.ts', 'test/**/*.int-spec.ts'],
          globalSetup: ['./test/global-setup.ts'],
          // Todas las pruebas comparten una base de datos: se ejecutan en serie,
          // en un único proceso, para que una no vea los datos a medio escribir
          // de otra.
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
