import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['app/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        jsx: true,
      },
    },
    rules: {
      'no-unused-vars': 'off',
    },
  },
];
