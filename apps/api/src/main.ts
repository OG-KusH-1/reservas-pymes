import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { PREFIJO_API, RUTA_DOCUMENTACION, VERSION_RUTAS, configurarApp } from './app.setup.js';
import type { Env } from './config/env.js';

/**
 * Punto de entrada de la API (NestJS sobre Express, en módulos ES).
 *
 * Solo crea la aplicación y abre el puerto. La configuración HTTP está en
 * `app.setup.ts` y la de los módulos en `app.module.ts`.
 */
async function bootstrap(): Promise<void> {
  // `bufferLogs` retiene los mensajes de arranque hasta que el registro
  // estructurado esté listo, para que también salgan en formato JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  configurarApp(app, config);

  const puerto = config.get('PORT', { infer: true });
  await app.listen(puerto);

  const base = `http://localhost:${puerto}`;
  logger.log(`API disponible en ${base}/${PREFIJO_API}/v${VERSION_RUTAS}`);
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    logger.log(`Documentación en ${base}/${RUTA_DOCUMENTACION}`);
  }
}

bootstrap().catch((error: unknown) => {
  // Aquí el registro estructurado puede no existir todavía (por ejemplo, si la
  // configuración de entorno es inválida), así que se usa la consola.
  console.error('No se pudo iniciar la API:', error);
  process.exit(1);
});
