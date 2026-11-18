import { Module } from '@nestjs/common';
import { HorariosController } from './horarios.controller.js';
import { HorariosService } from './horarios.service.js';

/**
 * Módulo de horarios semanales por profesional (`/api/v1/profesionales/:id/horarios`).
 */
@Module({
  controllers: [HorariosController],
  providers: [HorariosService],
})
export class HorariosModule {}
