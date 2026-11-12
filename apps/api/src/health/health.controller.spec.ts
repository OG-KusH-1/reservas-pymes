import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller.js';
import { HealthService, HealthCheckResponse } from './health.service.js';

describe('HealthController (Vitest)', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
    controller = new HealthController(service);
  });

  it('debe responder con status "ok" cuando los servicios están saludables', async () => {
    const mockResponse: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 10,
      environment: 'test',
      services: {
        api: 'healthy',
        database: 'connected',
      },
      version: '0.1.0',
    };

    vi.spyOn(service, 'check').mockResolvedValue(mockResponse);

    const result = await controller.getHealth();
    expect(result).toEqual(mockResponse);
    expect(result.status).toBe('ok');
    expect(result.services.api).toBe('healthy');
  });

  it('debe responder con status "degraded" cuando la base de datos no está disponible', async () => {
    const mockResponse: HealthCheckResponse = {
      status: 'degraded',
      timestamp: new Date().toISOString(),
      uptime: 10,
      environment: 'test',
      services: {
        api: 'healthy',
        database: 'disconnected',
      },
      version: '0.1.0',
    };

    vi.spyOn(service, 'check').mockResolvedValue(mockResponse);

    const result = await controller.getHealth();
    expect(result.status).toBe('degraded');
    expect(result.services.database).toBe('disconnected');
  });
});
