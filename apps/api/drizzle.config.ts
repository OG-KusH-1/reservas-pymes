import * as dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit se ejecuta desde `apps/api`; el `.env` vive en la raíz del monorepo.
dotenv.config({ path: '../../.env', quiet: true });
dotenv.config({ quiet: true });

/**
 * Configuración de drizzle-kit, que aquí se usa solo para GENERAR migraciones
 * (`pnpm db:generate`) y para explorar la base (`drizzle-kit studio`).
 *
 * Las migraciones se APLICAN con `src/db/migrate.ts` (`pnpm db:migrate`), no
 * con `drizzle-kit push`: `push` sincroniza el esquema sin dejar historial y
 * se saltaría las migraciones manuales (como la restricción antisolape).
 *
 * `generate` no se conecta a la base de datos, por eso la URL puede faltar.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
