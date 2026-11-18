import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RolMiembro, Sesion } from '@portfolio/contracts';
import type { Request } from 'express';
import { AppException } from '../common/errors/app.exception.js';

/** Clave de metadatos para rutas que no exigen sesión activa. */
export const CLAVE_PUBLICO = 'auth:publico';

/** Clave de metadatos para los roles permitidos en un endpoint. */
export const CLAVE_ROLES = 'auth:roles';

/**
 * Contexto de sesión resuelto por `SessionGuard` y adjuntado a la petición.
 *
 * Contiene el identificador de la sesión activa (para auditoría o revocación),
 * los datos públicos del usuario, la empresa activa (`sesiones.empresa_id`) y
 * el rol del usuario dentro de esa empresa.
 */
export interface ContextoSesion {
  sesionId: string;
  usuario: Sesion['usuario'];
  empresa: Sesion['empresa'];
  rol: RolMiembro;
}

/** Extensión tipada de la petición Express con el contexto de sesión adjunto. */
export interface PeticionConSesion extends Request {
  sesion?: ContextoSesion;
}

/**
 * Marca un controlador o método como público para que `SessionGuard` permita
 * el acceso sin cookie de sesión.
 */
export const Publico = (): MethodDecorator & ClassDecorator => SetMetadata(CLAVE_PUBLICO, true);

/**
 * Declara explícitamente los roles habilitados para ejecutar el endpoint.
 *
 * No existe jerarquía implícita entre roles: si un endpoint permite tanto a
 * `dueno` como a `admin`, ambos deben figurar en `@Roles('dueno', 'admin')`.
 */
export const Roles = (...roles: RolMiembro[]): MethodDecorator & ClassDecorator =>
  SetMetadata(CLAVE_ROLES, roles);

/**
 * Extrae el contexto completo de la sesión actual (`{ usuario, empresa, rol, sesionId }`).
 *
 * @throws AppException (`NO_AUTENTICADO`) si se usa en una ruta sin sesión válida.
 */
export const SesionActual = createParamDecorator(
  (_dato: unknown, ctx: ExecutionContext): ContextoSesion => {
    const peticion = ctx.switchToHttp().getRequest<PeticionConSesion>();
    if (!peticion.sesion) {
      throw AppException.noAutenticado();
    }
    return peticion.sesion;
  },
);

/**
 * Extrae el `empresaId` activo de la sesión autenticada.
 *
 * Es la **única** vía autorizada para que un controlador obtenga el tenant de
 * la petición; nunca debe leerse de la URL, la consulta ni el cuerpo.
 *
 * @throws AppException (`NO_AUTENTICADO`) si se usa en una ruta sin sesión válida.
 */
export const EmpresaId = createParamDecorator((_dato: unknown, ctx: ExecutionContext): string => {
  const peticion = ctx.switchToHttp().getRequest<PeticionConSesion>();
  if (!peticion.sesion) {
    throw AppException.noAutenticado();
  }
  return peticion.sesion.empresa.id;
});
