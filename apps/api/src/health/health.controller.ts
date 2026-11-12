import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthCheckResponse } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Endpoint de monitoreo: GET /api/health
   * 
   * ¿Por qué exponer este endpoint?
   * Brinda observabilidad inmediata para healthchecks de contenedores, balanceadores
   * y validación de comunicación desde la aplicación web (Next.js).
   */
  @Get()
  async getHealth(): Promise<HealthCheckResponse> {
    return this.healthService.check();
  }
}
