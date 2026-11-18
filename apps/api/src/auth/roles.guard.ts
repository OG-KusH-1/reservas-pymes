import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RolMiembro } from '@portfolio/contracts';
import { AppException } from '../common/errors/app.exception.js';
import { CLAVE_ROLES, type PeticionConSesion } from './auth.decorators.js';

/**
 * Guard global de autorización por rol dentro de la empresa activa.
 *
 * Debe ejecutarse después de `SessionGuard`. Si el endpoint no declara
 * `@Roles(...)`, basta con tener una sesión válida (o ser `@Publico()`).
 * No aplica jerarquía implícita entre roles: el rol de la sesión debe estar
 * listado explícitamente en `@Roles(...)`.
 *
 * @throws AppException (`NO_AUTENTICADO`) si falta `peticion.sesion` en una ruta con `@Roles`.
 * @throws AppException (`SIN_PERMISO`) si el rol de la sesión no está autorizado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<RolMiembro[] | undefined>(
      CLAVE_ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const peticion = context.switchToHttp().getRequest<PeticionConSesion>();
    if (!peticion.sesion) {
      throw AppException.noAutenticado();
    }

    if (!rolesPermitidos.includes(peticion.sesion.rol)) {
      throw AppException.sinPermiso();
    }

    return true;
  }
}
