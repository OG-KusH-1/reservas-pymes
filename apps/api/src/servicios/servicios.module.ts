import { Module } from '@nestjs/common';
import { ServiciosController } from './servicios.controller.js';
import { ServiciosService } from './servicios.service.js';

/**
 * Módulo del catálogo de servicios (`/api/v1/servicios`).
 *
 * Agrupa el controlador y el servicio que exponen el CRUD multiempresa de
 * servicios, registrado en `AppModule`.
 */
@Module({
  controllers: [ServiciosController],
  providers: [ServiciosService],
})
export class ServiciosModule {}
