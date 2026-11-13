import { z } from 'zod';

/**
 * Códigos de error estables de la API.
 *
 * La web decide qué hacer según `codigo` (nunca según el texto de `mensaje`,
 * que puede cambiar). Para agregar un error nuevo: añade el código aquí y
 * lánzalo en la API con `AppException` (ver `apps/api/src/common/errors`).
 * No renombres ni reutilices códigos existentes: son parte del contrato.
 */
export const CODIGOS_ERROR = [
  'VALIDACION',
  'NO_AUTENTICADO',
  'SIN_PERMISO',
  'NO_ENCONTRADO',
  'CONFLICTO',
  'RESERVA_SOLAPADA',
  'DEMASIADAS_SOLICITUDES',
  'INTERNO',
] as const;
export const codigoErrorSchema = z.enum(CODIGOS_ERROR);
export type CodigoError = z.infer<typeof codigoErrorSchema>;

/** Problema de validación de un campo concreto de la entrada. */
export const detalleErrorSchema = z.object({
  /** Ruta del campo con puntos, por ejemplo `cliente.correo`. Vacío si aplica a toda la entrada. */
  campo: z.string(),
  mensaje: z.string(),
});
export type DetalleError = z.infer<typeof detalleErrorSchema>;

/**
 * Forma única de toda respuesta de error de la API (cualquier estado 4xx/5xx).
 * La produce el filtro global de excepciones.
 */
export const errorApiSchema = z.object({
  codigo: codigoErrorSchema,
  /** Texto en español apto para mostrar a la persona usuaria. */
  mensaje: z.string(),
  /** Presente solo en errores de validación. */
  detalles: z.array(detalleErrorSchema).optional(),
  /** Identificador de la petición; permite ubicarla en los registros del servidor. */
  traceId: z.string().optional(),
});
export type ErrorApi = z.infer<typeof errorApiSchema>;
