import base from '../../eslint.config.base.js';

export default [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // Nest inyecta dependencias leyendo los tipos de los constructores en
        // tiempo de ejecución. Con estas opciones, la regla
        // `consistent-type-imports` sabe que una clase usada en una firma
        // decorada debe importarse como valor y no la convierte en `import type`
        // (lo que rompería la inyección sin ningún error de compilación).
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    },
  },
];
