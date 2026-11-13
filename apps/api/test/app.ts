import { ConfigService } from '@nestjs/config';
import type { Type } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/app.setup.js';
import type { Env } from '../src/config/env.js';
import type { Database } from '../src/db/client.js';
import { DRIZZLE } from '../src/db/database.module.js';
import { Mailer, type MensajeCorreo } from '../src/mail/mailer.js';

/**
 * Doble del puerto de correo: no envía nada y guarda los mensajes en memoria
 * para que la prueba pueda inspeccionarlos (`mailer.enviados`).
 */
export class MailerEnMemoria extends Mailer {
  readonly enviados: MensajeCorreo[] = [];

  enviar(mensaje: MensajeCorreo): Promise<void> {
    this.enviados.push(mensaje);
    return Promise.resolve();
  }
}

export interface OpcionesAppDePrueba {
  /**
   * Controladores adicionales que existen solo en la prueba. Sirven para
   * ejercitar piezas transversales (guards, pipes, filtro de errores) sin
   * depender de un endpoint real. Quedan bajo los mismos guards, pipes y
   * filtros globales que el resto de la aplicación.
   */
  controladores?: Type[];
}

export interface AppDePrueba {
  app: NestExpressApplication;
  /** Acceso directo a la base de datos para preparar datos y verificar efectos. */
  db: Database;
  mailer: MailerEnMemoria;
  /** Cierra la aplicación y sus conexiones. Llamar en `afterAll`. */
  cerrar: () => Promise<void>;
}

/**
 * Levanta la aplicación completa para una prueba de integración.
 *
 * Usa el `AppModule` real y la misma configuración HTTP que producción
 * (`configurarApp`), por lo que las rutas, la validación, el formato de
 * errores y las cookies se comportan igual. Solo se sustituye el envío de
 * correo. No abre un puerto: las peticiones se hacen con supertest sobre
 * `app.getHttpServer()`.
 *
 * @example
 * let prueba: AppDePrueba;
 * beforeAll(async () => { prueba = await crearAppDePrueba(); });
 * afterAll(() => prueba.cerrar());
 * beforeEach(() => limpiarBaseDeDatos(prueba.db));
 *
 * it('responde', async () => {
 *   await request(prueba.app.getHttpServer()).get('/api/v1/health').expect(200);
 * });
 */
export async function crearAppDePrueba(opciones: OpcionesAppDePrueba = {}): Promise<AppDePrueba> {
  const mailer = new MailerEnMemoria();
  const modulo = await Test.createTestingModule({
    imports: [AppModule],
    controllers: opciones.controladores,
  })
    .overrideProvider(Mailer)
    .useValue(mailer)
    .compile();

  const app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app, app.get<ConfigService<Env, true>>(ConfigService));
  await app.init();

  return {
    app,
    db: app.get<Database>(DRIZZLE),
    mailer,
    cerrar: () => app.close(),
  };
}

/**
 * Deja la base de datos vacía. Llamar en `beforeEach` para que cada prueba
 * parta de un estado conocido y no dependa del orden de ejecución.
 *
 * Basta con truncar las dos tablas raíz: `CASCADE` arrastra a todas las que
 * las referencian. Si se agrega una tabla que no cuelgue de `empresas` ni de
 * `usuarios`, hay que sumarla aquí.
 */
export async function limpiarBaseDeDatos(db: Database): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE empresas, usuarios RESTART IDENTITY CASCADE`);
}
