import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Salud } from '@portfolio/contracts';
import { VERSION_API } from '../common/version.js';
import type { Env } from '../config/env.js';
import type { PgClient } from '../db/client.js';
import { PG_CLIENT } from '../db/database.module.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(PG_CLIENT) private readonly pg: PgClient,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Comprueba el estado de la API y de sus dependencias.
   *
   * Nunca lanza una excepción: si la base de datos no responde devuelve
   * `status: 'degraded'` con HTTP 200. Así quien consulta puede distinguir
   * «la API está caída» (no hay respuesta) de «la API vive pero una
   * dependencia falla», que es justo lo que se necesita durante un arranque
   * o una migración.
   *
   * Al sumar una dependencia crítica (Redis en la Fase 5) agrégala a
   * `services` aquí y en `saludSchema` de `@portfolio/contracts`.
   */
  async check(): Promise<Salud> {
    const baseDeDatosDisponible = await this.pg`SELECT 1`.then(
      () => true,
      () => false,
    );

    return {
      status: baseDeDatosDisponible ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.config.get('NODE_ENV', { infer: true }),
      services: {
        api: 'healthy',
        database: baseDeDatosDisponible ? 'connected' : 'disconnected',
      },
      version: VERSION_API,
    };
  }
}
