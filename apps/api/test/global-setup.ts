import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { aplicarMigraciones } from '../src/db/migrate.js';

/**
 * Preparación global de las pruebas de integración (se ejecuta una sola vez
 * antes de todos los archivos `*.int-spec.ts`).
 *
 * Levanta un PostgreSQL desechable en un contenedor, con la misma versión
 * mayor que producción, y le aplica las migraciones reales. Se prueba contra
 * PostgreSQL de verdad (y no contra un sustituto en memoria) porque partes
 * centrales del sistema viven en la base de datos: la restricción antisolape
 * `EXCLUDE`, los `CHECK` y los tipos enumerados.
 *
 * Requiere Docker en ejecución. Para usar una base ya levantada (y ahorrar el
 * arranque del contenedor) define `TEST_DATABASE_URL`; debe ser una base
 * exclusiva para pruebas, porque su contenido se borra entre pruebas.
 */
let contenedor: StartedPostgreSqlContainer | undefined;

export async function setup(): Promise<void> {
  let url = process.env.TEST_DATABASE_URL;

  if (url && !/test|prueba/i.test(new URL(url).pathname)) {
    // Las pruebas vacían todas las tablas. Esta comprobación evita borrar por
    // descuido una base de desarrollo o de producción.
    throw new Error(
      'TEST_DATABASE_URL debe apuntar a una base cuyo nombre contenga "test" o "prueba".',
    );
  }

  if (!url) {
    contenedor = await new PostgreSqlContainer('postgres:17-alpine').start();
    url = contenedor.getConnectionUri();
  }

  await aplicarMigraciones(url);

  // Las variables definidas aquí las heredan los procesos de prueba. La
  // aplicación las lee con prioridad sobre el archivo `.env`, de modo que las
  // pruebas nunca tocan la base de datos de desarrollo.
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';
}

export async function teardown(): Promise<void> {
  await contenedor?.stop();
}
