import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Cargar variables de entorno considerando la raíz del monorepo
dotenv.config({ path: '../../.env' });
dotenv.config();

// Configuración de Drizzle Kit para PostgreSQL 17
// Por qué Drizzle Kit: Ofrece generación de migraciones SQL declarativas y sincronización directa
// sin la sobrecarga ni la complejidad de un motor de ejecución pesado en tiempo de compilación.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://portfolio_user:portfolio_password@localhost:5432/portfolio_reservas',
  },
});
