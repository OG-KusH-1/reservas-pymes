import { Injectable, type ArgumentMetadata, type PipeTransform } from '@nestjs/common';
import type { DetalleError } from '@portfolio/contracts';
import type { z } from 'zod';
import { AppException } from '../errors/app.exception.js';
import { esZodDto } from './zod-dto.js';

/**
 * Convierte los problemas de Zod al formato de `detalles` del contrato de error.
 * Exportada para validar con el mismo formato fuera del pipe (por ejemplo,
 * mensajes de una cola).
 */
export function aDetallesError(error: z.ZodError): DetalleError[] {
  return error.issues.map((issue) => ({
    campo: issue.path.join('.'),
    mensaje: issue.message,
  }));
}

/**
 * Pipe global de validación de entradas.
 *
 * Actúa sobre todo `@Body()`, `@Query()` y `@Param()` cuyo tipo sea un DTO
 * creado con `createZodDto`. Si la entrada no cumple el esquema responde 400
 * con código `VALIDACION` y el detalle por campo; si lo cumple, entrega al
 * controlador el valor ya transformado por Zod (valores por defecto, recortes
 * de espacios, conversiones de texto a número…).
 *
 * Los parámetros con tipos primitivos (`@Param('id') id: string`) pasan sin
 * tocar: para validarlos, agrúpalos en un DTO o usa `ZodPipe` con un esquema
 * puntual.
 *
 * Se registra una sola vez en `AppModule` con `APP_PIPE`; no hay que
 * declararlo en cada controlador.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(valor: unknown, metadatos: ArgumentMetadata): unknown {
    if (!esZodDto(metadatos.metatype)) {
      return valor;
    }
    const resultado = metadatos.metatype.schema.safeParse(valor);
    if (!resultado.success) {
      throw AppException.validacion(aDetallesError(resultado.error));
    }
    return resultado.data;
  }
}

/**
 * Pipe de validación para un único parámetro con un esquema puntual.
 *
 * @example
 * @Get(':id')
 * obtener(@Param('id', new ZodPipe(idSchema)) id: string) { ... }
 */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(valor: unknown, metadatos: ArgumentMetadata): z.output<T> {
    const resultado = this.schema.safeParse(valor);
    if (!resultado.success) {
      // Se antepone el nombre del parámetro para que el cliente sepa cuál falló.
      const detalles = aDetallesError(resultado.error).map((detalle) => ({
        ...detalle,
        campo: [metadatos.data, detalle.campo].filter(Boolean).join('.'),
      }));
      throw AppException.validacion(detalles);
    }
    return resultado.data;
  }
}
