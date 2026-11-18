import type { CookieOptions, Response } from 'express';
import { COOKIE_SESION } from '../app.setup.js';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

export interface OpcionesCookieSesion {
  /** Vigencia máxima de la cookie en días (`SESSION_TTL_DIAS`). */
  ttlDias: number;
  /** `true` en producción; activa el atributo `Secure` para exigir HTTPS. */
  esProduccion: boolean;
}

function opcionesBase(esProduccion: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: esProduccion,
  };
}

/**
 * Escribe la cookie `httpOnly` con el token opaco de sesión en la respuesta HTTP.
 *
 * El nombre se importa desde `COOKIE_SESION` (`app.setup.ts`) para mantener una
 * única fuente de verdad compartida con Swagger y los middlewares.
 */
export function establecerCookieSesion(
  respuesta: Response,
  token: string,
  opciones: OpcionesCookieSesion,
): void {
  respuesta.cookie(COOKIE_SESION, token, {
    ...opcionesBase(opciones.esProduccion),
    maxAge: opciones.ttlDias * MS_POR_DIA,
  });
}

/**
 * Elimina la cookie de sesión del navegador al cerrar sesión.
 *
 * Usa los mismos atributos de ruta y seguridad que `establecerCookieSesion`
 * para garantizar que el navegador invalide exactamente la cookie emitida.
 */
export function limpiarCookieSesion(
  respuesta: Response,
  opciones: Pick<OpcionesCookieSesion, 'esProduccion'>,
): void {
  respuesta.clearCookie(COOKIE_SESION, opcionesBase(opciones.esProduccion));
}
