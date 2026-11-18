import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { COOKIE_SESION } from '../app.setup.js';
import { AppException } from '../common/errors/app.exception.js';
import { CLAVE_PUBLICO, type PeticionConSesion } from './auth.decorators.js';
import { SessionService } from './session.service.js';

/**
 * Guard global de autenticación por sesión en cookie `httpOnly`.
 *
 * Toda ruta exige una sesión válida salvo las marcadas con `@Publico()`.
 * Cuando la sesión es válida, adjunta `ContextoSesion` a `peticion.sesion`
 * para que los controladores y `RolesGuard` lo consuman sin volver a consultar
 * la base de datos.
 *
 * @throws AppException (`NO_AUTENTICADO`) si falta la cookie o la sesión no es válida.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublico = this.reflector.getAllAndOverride<boolean>(CLAVE_PUBLICO, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublico) {
      return true;
    }

    const peticion = context.switchToHttp().getRequest<PeticionConSesion>();
    const token: unknown = (peticion.cookies as Record<string, unknown> | undefined)?.[
      COOKIE_SESION
    ];
    if (typeof token !== 'string' || token.length === 0) {
      throw AppException.noAutenticado();
    }

    const sesion = await this.sessionService.validar(token);
    if (!sesion) {
      throw AppException.noAutenticado();
    }

    peticion.sesion = sesion;
    return true;
  }
}
