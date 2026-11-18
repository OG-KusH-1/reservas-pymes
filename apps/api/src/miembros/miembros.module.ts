import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmpresasUsuarioController } from './empresas-usuario.controller.js';
import { InvitacionesPublicoController } from './invitaciones-publico.controller.js';
import { InvitacionesController } from './invitaciones.controller.js';
import { InvitacionesService } from './invitaciones.service.js';
import { MiembrosController } from './miembros.controller.js';
import { MiembrosService } from './miembros.service.js';

/**
 * Módulo de gestión de miembros, invitaciones y cambio de empresa activa.
 *
 * Importa `AuthModule` para reutilizar `SessionService` al emitir sesiones tras
 * aceptar una invitación. Se registra en `AppModule` desde la base común.
 */
@Module({
  imports: [AuthModule],
  controllers: [
    MiembrosController,
    InvitacionesController,
    InvitacionesPublicoController,
    EmpresasUsuarioController,
  ],
  providers: [MiembrosService, InvitacionesService],
})
export class MiembrosModule {}
