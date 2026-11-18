import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AppException } from '../common/errors/app.exception.js';
import type { Env } from '../config/env.js';

const METODOS_MUTACION = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defensa adicional contra CSRF basada en la cabecera `Origin`.
 *
 * En peticiones que modifican estado (`POST`, `PUT`, `PATCH`, `DELETE`), si el
 * cliente envía la cabecera `Origin`, debe coincidir exactamente con `WEB_URL`
 * (ya normalizado como origen sin barra final en `env.ts`). Los clientes que
 * no son navegadores (pruebas, herramientas CLI) no envían `Origin` y pasan.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const peticion = context.switchToHttp().getRequest<Request>();
    if (!METODOS_MUTACION.has(peticion.method.toUpperCase())) {
      return true;
    }

    const origen = peticion.headers.origin;
    if (origen === undefined) {
      return true;
    }

    const origenPermitido = this.config.get('WEB_URL', { infer: true });
    if (origen !== origenPermitido) {
      throw AppException.sinPermiso('Origen de la petición no permitido');
    }

    return true;
  }
}
