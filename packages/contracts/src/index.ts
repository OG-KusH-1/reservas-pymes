/**
 * Punto de entrada de `@portfolio/contracts`.
 *
 * Este paquete es el contrato entre la API y la web: todo dato que cruza la
 * red se define aquí una sola vez como esquema Zod, y de él se derivan los
 * tipos. La API valida las entradas con estos esquemas y la web los usa para
 * tipar respuestas y validar formularios.
 *
 * Organización: un archivo por área (`dominio`, `errores`, …). Los DTO de
 * cada módulo funcional van en su propio archivo (por ejemplo `auth.ts`,
 * `servicios.ts`) y se reexportan desde aquí.
 *
 * Tras modificar el paquete hay que recompilarlo (`pnpm contracts:build`);
 * `pnpm dev` lo mantiene compilado en modo observación.
 */
import { z } from 'zod';

// Mensajes de validación en español para todos los esquemas que no definen
// uno propio. Se configura aquí porque este módulo es el punto de entrada
// común de la API y de la web; `zod` debe resolverse a una única copia en el
// monorepo para que la configuración sea compartida.
z.config(z.locales.es());

export * from './auth.js';
export * from './comunes.js';
export * from './dominio.js';
export * from './errores.js';
export * from './paginacion.js';
export * from './salud.js';
