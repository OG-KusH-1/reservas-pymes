import type { CodigoError, DetalleError } from '@portfolio/contracts';

/**
 * Estado HTTP que corresponde a cada código de error del contrato.
 * Al agregar un código en `@portfolio/contracts`, TypeScript obliga a
 * completar esta tabla.
 */
export const ESTADO_HTTP_POR_CODIGO: Readonly<Record<CodigoError, number>> = {
  VALIDACION: 400,
  NO_AUTENTICADO: 401,
  SIN_PERMISO: 403,
  NO_ENCONTRADO: 404,
  CONFLICTO: 409,
  RESERVA_SOLAPADA: 409,
  DEMASIADAS_SOLICITUDES: 429,
  INTERNO: 500,
};

/**
 * Excepción de negocio de la API. Es la forma recomendada de devolver un error
 * desde un servicio o controlador: el filtro global la convierte en la
 * respuesta estándar `{ codigo, mensaje, detalles?, traceId }`.
 *
 * El `mensaje` se muestra a la persona usuaria: escríbelo en español, sin
 * detalles técnicos ni datos de otras empresas.
 *
 * @example
 * throw new AppException('NO_ENCONTRADO', 'El servicio no existe');
 * throw AppException.conflicto('Ya existe un servicio con ese nombre');
 */
export class AppException extends Error {
  readonly estado: number;

  constructor(
    readonly codigo: CodigoError,
    mensaje: string,
    readonly detalles?: DetalleError[],
  ) {
    super(mensaje);
    this.name = 'AppException';
    this.estado = ESTADO_HTTP_POR_CODIGO[codigo];
  }

  static noEncontrado(mensaje = 'El recurso solicitado no existe'): AppException {
    return new AppException('NO_ENCONTRADO', mensaje);
  }

  static noAutenticado(mensaje = 'Debes iniciar sesión'): AppException {
    return new AppException('NO_AUTENTICADO', mensaje);
  }

  static sinPermiso(mensaje = 'No tienes permiso para realizar esta acción'): AppException {
    return new AppException('SIN_PERMISO', mensaje);
  }

  static conflicto(mensaje: string): AppException {
    return new AppException('CONFLICTO', mensaje);
  }

  static validacion(detalles: DetalleError[], mensaje = 'Los datos enviados no son válidos') {
    return new AppException('VALIDACION', mensaje, detalles);
  }
}
