import type { z } from 'zod';

/**
 * Clase DTO respaldada por un esquema Zod.
 *
 * Nest identifica el tipo de un `@Body()`, `@Query()` o `@Param()` por la
 * clase declarada en la firma del método. Un esquema Zod no es una clase, así
 * que `createZodDto` fabrica una que lo lleva en la propiedad estática
 * `schema`; el `ZodValidationPipe` global la detecta y valida la entrada.
 */
export interface ZodDto<T extends z.ZodType = z.ZodType> {
  new (): z.output<T>;
  readonly schema: T;
}

/**
 * Crea la clase DTO de un esquema de `@portfolio/contracts`.
 *
 * @example
 * // servicios.dto.ts
 * export class CrearServicioDto extends createZodDto(crearServicioSchema) {}
 *
 * // servicios.controller.ts
 * @Post()
 * crear(@Body() datos: CrearServicioDto) { ... } // `datos` llega validado y tipado
 *
 * Importante: importa el DTO como valor (`import { CrearServicioDto }`), no
 * con `import type`; de lo contrario la clase desaparece al compilar y la
 * entrada quedaría sin validar.
 */
export function createZodDto<T extends z.ZodType>(schema: T): ZodDto<T> {
  class DtoGenerado {
    static readonly schema = schema;
  }
  return DtoGenerado as unknown as ZodDto<T>;
}

/** Indica si el tipo declarado en la firma de un controlador es un DTO de Zod. */
export function esZodDto(tipo: unknown): tipo is ZodDto {
  return (
    typeof tipo === 'function' &&
    'schema' in tipo &&
    typeof (tipo.schema as { safeParse?: unknown } | undefined)?.safeParse === 'function'
  );
}
