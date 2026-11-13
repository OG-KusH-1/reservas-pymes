import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { ZodValidationPipe } from './common/zod/zod-validation.pipe.js';
import { RUTAS_ENV, validarEntorno, type AppConfig } from './config/env.js';
import { DatabaseModule } from './db/database.module.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';

/**
 * Módulo raíz de la API.
 *
 * Aquí se conecta la infraestructura transversal (configuración, registro,
 * base de datos, correo, límite de peticiones) y los comportamientos globales
 * (validación y formato de errores). Los módulos de negocio se agregan al
 * final de `imports`, uno por área funcional (`AuthModule`, `ServiciosModule`…),
 * y no necesitan volver a importar la infraestructura global.
 *
 * Los proveedores `APP_*` se registran aquí y no en `main.ts` para que también
 * estén activos en las pruebas de integración, que levantan este mismo módulo.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: RUTAS_ENV,
      validate: validarEntorno,
    }),

    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfig) => {
        const entorno = config.get('NODE_ENV', { infer: true });
        return {
          pinoHttp: {
            level: entorno === 'test' ? 'silent' : config.get('LOG_LEVEL', { infer: true }),
            // Identificador por petición: se respeta el que envíe un proxy o
            // balanceador para poder seguir la petición de punta a punta.
            genReqId: (peticion, respuesta) => {
              const recibido = peticion.headers['x-request-id'];
              // Solo se acepta un id con forma razonable: llega de fuera y se
              // escribe en registros y cabeceras.
              const id =
                typeof recibido === 'string' && /^[\w-]{1,64}$/.test(recibido)
                  ? recibido
                  : randomUUID();
              respuesta.setHeader('x-request-id', id);
              return id;
            },
            // De cada petición se registra solo lo necesario para diagnosticar.
            // Las cabeceras quedan fuera a propósito: contienen la cookie de
            // sesión y otros datos que no deben terminar en los registros.
            serializers: {
              req: (peticion: { id: unknown; method: string; url: string }) => ({
                id: peticion.id,
                method: peticion.method,
                // Sin la cadena de consulta: puede llevar tokens o datos personales.
                url: peticion.url.split('?')[0],
              }),
              res: (respuesta: { statusCode: number }) => ({ statusCode: respuesta.statusCode }),
            },
            // El chequeo de salud se llama cada pocos segundos; registrarlo solo agrega ruido.
            autoLogging: { ignore: (peticion) => peticion.url?.endsWith('/health') ?? false },
            // Salida legible en desarrollo; JSON estructurado en producción.
            transport:
              entorno === 'development'
                ? {
                    target: 'pino-pretty',
                    options: { singleLine: true, translateTime: 'HH:MM:ss' },
                  }
                : undefined,
          },
        };
      },
    }),

    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfig) => [
        {
          ttl: seconds(config.get('THROTTLE_TTL_SEGUNDOS', { infer: true })),
          limit: config.get('THROTTLE_LIMITE', { infer: true }),
        },
      ],
    }),

    DatabaseModule,
    MailModule,
    HealthModule,
  ],
  providers: [
    // Límite global de peticiones por IP. Los endpoints sensibles (inicio de
    // sesión, reserva pública) deben endurecerlo con `@Throttle()`.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
