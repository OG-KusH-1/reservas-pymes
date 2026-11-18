import { Module } from '@nestjs/common';
import { ProfesionalesController } from './profesionales.controller.js';
import { ProfesionalesService } from './profesionales.service.js';

/**
 * Módulo de profesionales y asignación de servicios (`/api/v1/profesionales`).
 */
@Module({
  controllers: [ProfesionalesController],
  providers: [ProfesionalesService],
})
export class ProfesionalesModule {}
