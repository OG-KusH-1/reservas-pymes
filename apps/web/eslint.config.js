import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';
import base from '../../eslint.config.base.js';

export default [
  {
    ignores: [
      // Componentes generados por la CLI de shadcn/ui: se mantienen tal como
      // llegan para poder actualizarlos con `pnpm dlx shadcn add --overwrite`.
      'components/ui/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  // Reglas de Next (enlaces, imágenes, Core Web Vitals), React y hooks.
  ...nextVitals,
  ...nextTypescript,
  // La base del monorepo va después para que sus reglas prevalezcan.
  ...base.filter((config) => !config.plugins?.['@typescript-eslint']),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Los archivos de configuración exportan su objeto directamente por convención.
    files: ['*.config.{js,mjs,ts}'],
    rules: { 'import/no-anonymous-default-export': 'off' },
  },
  prettier,
];
