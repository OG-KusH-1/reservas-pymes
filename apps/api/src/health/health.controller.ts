import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { saludSchema, type Salud } from '@portfolio/contracts';
import { ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { HealthService } from './health.service.js';

@ApiTags('Sistema')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * `GET /api/v1/health`
   *
   * Lo consultan los chequeos de salud de los contenedores y la página de
   * estado de la web. Queda fuera del límite de peticiones porque los
   * orquestadores lo llaman cada pocos segundos desde la misma IP.
   */
  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Estado de la API y de sus dependencias' })
  @ApiZodResponse(saludSchema)
  getHealth(): Promise<Salud> {
    return this.healthService.check();
  }
}
