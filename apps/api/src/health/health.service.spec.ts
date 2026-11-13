import type { ConfigService } from '@nestjs/config';
import { saludSchema } from '@portfolio/contracts';
import { describe, expect, it } from 'vitest';
import type { Env } from '../config/env.js';
import type { PgClient } from '../db/client.js';
import { HealthService } from './health.service.js';

/** Doble mínimo del cliente de PostgreSQL: solo importa si la consulta resuelve o falla. */
function clienteFalso(responde: boolean): PgClient {
  const consulta = () =>
    responde ? Promise.resolve([]) : Promise.reject(new Error('sin conexión'));
  return consulta as unknown as PgClient;
}

const config = { get: () => 'test' } as unknown as ConfigService<Env, true>;

describe('HealthService', () => {
  it('responde "ok" cuando la base de datos contesta', async () => {
    const salud = await new HealthService(clienteFalso(true), config).check();

    expect(salud.status).toBe('ok');
    expect(salud.services.database).toBe('connected');
    // La respuesta debe cumplir el contrato que consume la web.
    expect(saludSchema.safeParse(salud).success).toBe(true);
  });

  it('responde "degraded" sin lanzar cuando la base de datos no contesta', async () => {
    const salud = await new HealthService(clienteFalso(false), config).check();

    expect(salud.status).toBe('degraded');
    expect(salud.services.database).toBe('disconnected');
    expect(saludSchema.safeParse(salud).success).toBe(true);
  });
});
