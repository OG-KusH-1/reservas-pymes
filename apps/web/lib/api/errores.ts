import type { CodigoError, DetalleError, ErrorApi } from '@portfolio/contracts';

/**
 * Error de una llamada a la API. Es el único tipo de error que lanzan los
 * clientes de `lib/api`, tanto si la API respondió con un error como si no se
 * pudo conectar o la respuesta no tenía la forma esperada.
 *
 * Decide el comportamiento por `codigo` (estable, parte del contrato) y
 * muestra `message` a la persona usuaria (ya viene en español).
 *
 * @example
 * try {
 *   await api.post('/servicios', { cuerpo });
 * } catch (error) {
 *   if (esApiError(error, 'VALIDACION')) aplicarErroresAlFormulario(form, error);
 *   else toast.error(mensajeDeError(error));
 * }
 */
export class ApiError extends Error {
  readonly codigo: CodigoError;
  /** Estado HTTP. Es 0 cuando no hubo respuesta (sin conexión, petición abortada). */
  readonly estado: number;
  /** Errores por campo; presentes cuando `codigo` es `VALIDACION`. */
  readonly detalles: DetalleError[];
  /** Identificador de la petición para ubicarla en los registros del servidor. */
  readonly traceId?: string;

  constructor(estado: number, cuerpo: ErrorApi) {
    super(cuerpo.mensaje);
    this.name = 'ApiError';
    this.estado = estado;
    this.codigo = cuerpo.codigo;
    this.detalles = cuerpo.detalles ?? [];
    this.traceId = cuerpo.traceId;
  }
}

/** Comprueba si un error desconocido es un `ApiError` (y, opcionalmente, de un código dado). */
export function esApiError(error: unknown, codigo?: CodigoError): error is ApiError {
  return error instanceof ApiError && (codigo === undefined || error.codigo === codigo);
}

/** Texto apto para mostrar a partir de cualquier error capturado. */
export function mensajeDeError(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Ocurrió un error inesperado. Inténtalo nuevamente.';
}
