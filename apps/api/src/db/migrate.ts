import { fileURLToPath, pathToFileURL } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { cargarEntorno } from '../config/load-env.js';
import { crearClientePg, crearDrizzle } from './client.js';

/** Carpeta de migraciones SQL (`apps/api/drizzle`). Misma ruta relativa desde `src/db` y `dist/db`. */
export const CARPETA_MIGRACIONES = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Aplica las migraciones pendientes sobre la base de datos indicada.
 *
 * Drizzle anota las migraciones aplicadas en la tabla `drizzle.__drizzle_migrations`,
 * por lo que es seguro ejecutarla varias veces: solo corre las que falten.
 *
 * La usan tres consumidores, y por eso está separada del script:
 *  - `pnpm db:migrate` en desarrollo;
 *  - el arranque del contenedor en producción (`node dist/db/migrate.js`),
 *    que así no necesita `drizzle-kit` en la imagen;
 *  - las pruebas de integración, sobre una base de datos temporal.
 *
 * Usa una conexión propia de un solo cliente (requisito del migrador) y la
 * cierra al terminar.
 */
export async function aplicarMigraciones(databaseUrl: string): Promise<void> {
  const cliente = crearClientePg(databaseUrl, { max: 1 });
  try {
    await migrate(crearDrizzle(cliente), { migrationsFolder: CARPETA_MIGRACIONES });
  } finally {
    await cliente.end();
  }
}

// Ejecución directa como script (`tsx src/db/migrate.ts` o `node dist/db/migrate.js`).
// Al importarse desde las pruebas esta condición es falsa y no se ejecuta nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { DATABASE_URL } = cargarEntorno();
  aplicarMigraciones(DATABASE_URL)
    .then(() => {
      console.warn('Migraciones aplicadas.');
    })
    .catch((error: unknown) => {
      console.error('Error al aplicar las migraciones:', error);
      process.exit(1);
    });
}
