import { z } from 'zod';

/**
 * Paginación por cursor, común a todos los listados de la API.
 *
 * Se eligió cursor en lugar de `offset` porque las agendas cambian mientras se
 * navegan: con `offset`, una reserva nueva desplaza las páginas y produce
 * elementos repetidos u omitidos. El cursor es opaco para el cliente: solo
 * debe devolver el `siguienteCursor` que recibió.
 */
export const LIMITE_PAGINA_PREDETERMINADO = 20;
export const LIMITE_PAGINA_MAXIMO = 100;

/** Parámetros de consulta de un listado. Los valores llegan como texto en la URL. */
export const consultaPaginadaSchema = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limite: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITE_PAGINA_MAXIMO)
    .default(LIMITE_PAGINA_PREDETERMINADO),
});
export type ConsultaPaginada = z.infer<typeof consultaPaginadaSchema>;

/**
 * Crea el esquema de una página de resultados para un tipo de elemento.
 *
 * @example
 * const paginaServiciosSchema = paginaSchema(servicioSchema);
 */
export function paginaSchema<T extends z.ZodType>(elemento: T) {
  return z.object({
    datos: z.array(elemento),
    /** `null` cuando no hay más páginas. */
    siguienteCursor: z.string().nullable(),
  });
}

/** Tipo de una página de resultados de elementos `T`. */
export interface Pagina<T> {
  datos: T[];
  siguienteCursor: string | null;
}
