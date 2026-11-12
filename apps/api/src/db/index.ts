import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '../../.env' });
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://portfolio_user:portfolio_password@localhost:5432/portfolio_reservas';

/**
 * Cliente de conexión PostgreSQL utilizando 'postgres.js'.
 * 
 * ¿Por qué postgres.js?
 * Es el driver más rápido del ecosistema Node.js, compatible nativamente con ESM
 * y sin dependencias nativas de C que compliquen el build en contenedores o CI.
 */
export const queryClient = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 20 : 5,
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
