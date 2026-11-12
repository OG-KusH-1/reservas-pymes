import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as dotenv from 'dotenv';

// Cargar variables de entorno considerando la estructura monorepo
dotenv.config({ path: '../../.env' });
dotenv.config();

/**
 * Punto de entrada principal para NestJS 12 en modo ECMAScript Modules (ESM).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuración de CORS para permitir peticiones seguras desde apps/web
  const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: allowedOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Prefijo global 'api' para versionamiento y organización estandarizada
  // Ejemplo: GET /api/health
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 API iniciada exitosamente en: http://localhost:${port}/api/health`);
}

bootstrap().catch((err) => {
  console.error('Error al iniciar la API NestJS:', err);
  process.exit(1);
});
