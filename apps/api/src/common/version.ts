import { readFileSync } from 'node:fs';

/**
 * Versión de la API, leída de `apps/api/package.json` para no duplicarla.
 * La ruta relativa es la misma desde `src/common` y desde `dist/common`.
 */
export const VERSION_API: string = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;
