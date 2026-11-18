import type { Pagina } from '@portfolio/contracts';
import type { z } from 'zod';
import { AppException } from './errors/app.exception.js';

/**
 * Utilidad de paginación por cursor para listados de la API.
 *
 * El cursor es una cadena base64url opaca para el cliente que serializa la
 * clave de ordenamiento del último elemento entregado (por ejemplo `{ nombre, id }`
 * o `{ creadoEn, id }`). Al consultar `limite + 1` filas se determina si existe
 * una página siguiente sin necesidad de ejecutar un `COUNT(*)` adicional.
 */

/**
 * Codifica los campos del cursor en una cadena `base64url` opaca.
 *
 * @example
 * const cursor = codificarCursor({ nombre: 'Corte', id: '...' });
 */
export function codificarCursor<T extends Record<string, unknown>>(datos: T): string {
  return Buffer.from(JSON.stringify(datos), 'utf8').toString('base64url');
}

/**
 * Decodifica y valida un cursor recibido por consulta.
 *
 * Si el cursor está mal formado, no es JSON válido o no cumple el esquema
 * esperado, lanza `AppException('VALIDACION')` sobre el campo `cursor` para
 * evitar errores 500 ante entradas manipuladas.
 *
 * @throws {AppException} `VALIDACION` (400) si el cursor no es válido.
 */
export function decodificarCursor<T>(cursor: string, esquema: z.ZodType<T>): T {
  let texto: string;
  try {
    texto = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw AppException.validacion([{ campo: 'cursor', mensaje: 'Cursor de paginación inválido' }]);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(texto);
  } catch {
    throw AppException.validacion([{ campo: 'cursor', mensaje: 'Cursor de paginación inválido' }]);
  }

  const resultado = esquema.safeParse(parsed);
  if (!resultado.success) {
    throw AppException.validacion([{ campo: 'cursor', mensaje: 'Cursor de paginación inválido' }]);
  }

  return resultado.data;
}

/**
 * Construye una página `{ datos, siguienteCursor }` a partir de un conjunto de
 * filas consultadas con `limit(limite + 1)`.
 *
 * Si la consulta devolvió más de `limite` filas, recorta el excedente y
 * genera el cursor a partir del último elemento incluido en `datos`.
 */
export function paginarResultados<T>(
  filas: readonly T[],
  limite: number,
  crearCursor: (ultimo: T) => string,
): Pagina<T> {
  const hayMas = filas.length > limite;
  const datos = hayMas ? filas.slice(0, limite) : [...filas];
  const ultimo = datos[datos.length - 1];

  return {
    datos,
    siguienteCursor: hayMas && ultimo !== undefined ? crearCursor(ultimo) : null,
  };
}
