import { Module } from '@nestjs/common';
import { CuentaModule } from '../cuenta/cuenta.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { OriginGuard } from './origin.guard.js';
import { PasswordService } from './password.service.js';
import { RolesGuard } from './roles.guard.js';
import { SessionGuard } from './session.guard.js';
import { SessionService } from './session.service.js';

/**
 * Módulo de autenticación, sesiones opacas y autorización por rol.
 *
 * Exporta `SessionService` y los guards para que `AppModule` los registre
 * globalmente mediante `APP_GUARD`.
 */
@Module({
  imports: [CuentaModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, SessionService, OriginGuard, SessionGuard, RolesGuard],
  exports: [SessionService, OriginGuard, SessionGuard, RolesGuard],
})
export class AuthModule {}
