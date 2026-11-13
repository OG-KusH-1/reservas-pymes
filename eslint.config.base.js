import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Configuración base de ESLint compartida por todos los paquetes del monorepo.
 *
 * Cada paquete tiene su propio `eslint.config.js`, que importa esta base y le
 * agrega lo específico (reglas de Next en la web, por ejemplo). Así una regla
 * nueva se define una sola vez.
 *
 * `eslint-config-prettier` va al final a propósito: desactiva las reglas de
 * estilo que chocarían con Prettier, que es quien decide el formato.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/drizzle/**', '**/next-env.d.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Los parámetros con prefijo `_` son la convención para "sin usar a propósito".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // Nest necesita importar las clases como valor para la inyección de
        // dependencias; `inline-type-imports` permite mezclar ambos casos.
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  prettier,
);
