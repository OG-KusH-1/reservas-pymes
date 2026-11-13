import * as dotenv from 'dotenv';
import { RUTAS_ENV, validarEntorno, type Env } from './env.js';

/**
 * Carga y valida el entorno para los scripts que se ejecutan fuera de Nest
 * (migraciones, seed). Dentro de la aplicación no se usa: ahí la configuración
 * llega por `ConfigService`.
 *
 * `dotenv` no pisa las variables ya definidas, así que lo que venga del
 * sistema (CI, contenedor) siempre gana sobre los archivos `.env`.
 */
export function cargarEntorno(): Env {
  for (const ruta of RUTAS_ENV) {
    dotenv.config({ path: ruta, quiet: true });
  }
  return validarEntorno(process.env);
}
