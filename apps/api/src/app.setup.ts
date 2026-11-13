import { VersioningType } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { VERSION_API } from './common/version.js';
import type { Env } from './config/env.js';

/** Prefijo común de todas las rutas. Con el versionado, las rutas quedan en `/api/v1/...`. */
export const PREFIJO_API = 'api';
export const VERSION_RUTAS = '1';
/** Ruta de la documentación interactiva (solo fuera de producción). */
export const RUTA_DOCUMENTACION = 'api/docs';
/** Nombre de la cookie de sesión del panel. Único lugar donde se define. */
export const COOKIE_SESION = 'agenda_sesion';

/**
 * Aplica la configuración HTTP de la aplicación.
 *
 * Vive fuera de `main.ts` para que las pruebas de integración configuren la
 * aplicación exactamente igual que en producción (mismas rutas, cabeceras y
 * cookies) sin abrir un puerto.
 */
export function configurarApp(app: NestExpressApplication, config: ConfigService<Env, true>): void {
  const entorno = config.get('NODE_ENV', { infer: true });

  // La API se publica detrás de la web (rewrites de Next) o de un balanceador.
  // Con `trust proxy` Express toma la IP real de `X-Forwarded-For`; sin esto,
  // el límite de peticiones contaría a todos los usuarios como una sola IP.
  // Solo se confía en la cantidad de saltos configurada (`TRUST_PROXY`), para
  // que un cliente no pueda falsificar su IP agregando la cabecera por su cuenta.
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }));

  app.setGlobalPrefix(PREFIJO_API);
  // Versión en la URL: permite publicar una `v2` de un endpoint sin romper a
  // los clientes de la `v1`. Para versionar un controlador: `@Controller({ path, version: '2' })`.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: VERSION_RUTAS });

  app.use(helmet());
  // Necesario para leer la cookie de sesión `httpOnly`.
  app.use(cookieParser());

  // En producción la web y la API comparten origen gracias a los rewrites, por
  // lo que CORS no interviene. Se habilita solo para la web configurada, que
  // es el caso de desarrollo cuando se llama a la API directamente.
  app.enableCors({
    origin: config.get('WEB_URL', { infer: true }),
    credentials: true,
  });

  // Cierra conexiones (base de datos, correo) al recibir SIGTERM/SIGINT.
  app.enableShutdownHooks();

  if (entorno !== 'production') {
    const documento = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Agenda API')
        .setDescription('API de agendamiento de servicios multiempresa')
        .setVersion(VERSION_API)
        .addCookieAuth(COOKIE_SESION)
        .build(),
    );
    SwaggerModule.setup(RUTA_DOCUMENTACION, app, documento);
  }
}
