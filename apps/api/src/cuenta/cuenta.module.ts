import { Module } from '@nestjs/common';
import { CuentaController } from './cuenta.controller.js';
import { CuentaService } from './cuenta.service.js';

/**
 * Módulo de verificación de correo, recuperación y cambio de contraseña.
 * Exporta `CuentaService` para que `AuthModule` envíe el correo de
 * verificación tras el registro sin dependencias circulares.
 */
@Module({
  controllers: [CuentaController],
  providers: [CuentaService],
  exports: [CuentaService],
})
export class CuentaModule {}
