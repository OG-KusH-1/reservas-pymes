import { Module } from '@nestjs/common';
import { EmpresaController } from './empresa.controller.js';
import { EmpresaService } from './empresa.service.js';

/**
 * Módulo de configuración de la empresa activa y sus políticas de reserva.
 *
 * Se registra en `AppModule` y expone `GET /empresa` y `PATCH /empresa`.
 */
@Module({
  controllers: [EmpresaController],
  providers: [EmpresaService],
})
export class EmpresaModule {}
