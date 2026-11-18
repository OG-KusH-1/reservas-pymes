import { Module } from '@nestjs/common';
import { BloqueosController } from './bloqueos.controller.js';
import { BloqueosService } from './bloqueos.service.js';

/**
 * Módulo de bloqueos puntuales de disponibilidad (`/api/v1/bloqueos`).
 */
@Module({
  controllers: [BloqueosController],
  providers: [BloqueosService],
})
export class BloqueosModule {}
