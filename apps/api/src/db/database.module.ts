import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/env.js';
import { crearClientePg, crearDrizzle, type PgClient } from './client.js';

/**
 * Token de inyección de la instancia de Drizzle.
 *
 * @example
 * constructor(@Inject(DRIZZLE) private readonly db: Database) {}
 */
export const DRIZZLE = Symbol('DRIZZLE');

/** Token del cliente de postgres.js. Solo para SQL directo (por ejemplo, el chequeo de salud). */
export const PG_CLIENT = Symbol('PG_CLIENT');

/**
 * Módulo global de acceso a datos.
 *
 * La conexión se crea como proveedor de Nest (y no como un singleton que se
 * conecta al importarse) por dos razones:
 *  - las pruebas pueden sustituir `PG_CLIENT` o `DRIZZLE` por una base de
 *    datos temporal o por un doble, sin tocar el código de producción;
 *  - el pool se cierra de forma ordenada cuando la aplicación se detiene, de
 *    modo que un despliegue no corta consultas en curso.
 *
 * Es `@Global` porque casi todos los módulos consultan la base de datos; así
 * no hay que importarlo en cada uno.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_CLIENT,
      inject: [ConfigService],
      useFactory: (config: AppConfig): PgClient =>
        crearClientePg(config.get('DATABASE_URL', { infer: true }), {
          max: config.get('DATABASE_POOL_MAX', { infer: true }),
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_CLIENT],
      useFactory: (cliente: PgClient) => crearDrizzle(cliente),
    },
  ],
  exports: [DRIZZLE, PG_CLIENT],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_CLIENT) private readonly cliente: PgClient) {}

  /**
   * Cierra el pool al apagar la aplicación. Espera hasta 5 segundos a que
   * terminen las consultas en curso antes de cortar las conexiones.
   * Requiere `app.enableShutdownHooks()` (ver `app.setup.ts`).
   */
  async onApplicationShutdown(): Promise<void> {
    await this.cliente.end({ timeout: 5 });
  }
}
