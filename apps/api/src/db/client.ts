import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

/** Cliente de bajo nivel de postgres.js (consultas SQL directas y cierre del pool). */
export type PgClient = postgres.Sql;

/**
 * Instancia de Drizzle con el esquema completo. Es el tipo que deben declarar
 * los servicios al inyectar la base de datos.
 */
export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Transacción abierta. Tiene la misma interfaz de consulta que {@link Database},
 * por lo que un método de repositorio puede aceptar `Database | Transaccion`
 * y funcionar dentro o fuera de una transacción.
 */
export type Transaccion = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface OpcionesConexion {
  /** Conexiones máximas del pool. */
  max?: number;
}

/**
 * Crea el pool de conexiones a PostgreSQL.
 *
 * Se usa postgres.js porque es ESM nativo y no tiene binarios que compilar,
 * lo que simplifica las imágenes de contenedor y el CI.
 *
 * `onnotice` se silencia porque PostgreSQL emite avisos informativos (por
 * ejemplo «la extensión ya existe» al migrar) que ensucian los registros.
 */
export function crearClientePg(url: string, opciones: OpcionesConexion = {}): PgClient {
  return postgres(url, {
    max: opciones.max ?? 10,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
}

/** Envuelve un cliente de postgres.js con Drizzle y el esquema de la aplicación. */
export function crearDrizzle(cliente: PgClient): Database {
  return drizzle(cliente, { schema });
}
