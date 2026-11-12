import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Pipe de validación basado en Zod para NestJS.
 * 
 * ¿Por qué Zod en lugar de class-validator?
 * 1. Mayor velocidad y menor footprint en ESM (sin depender de reflect-metadata excesivo).
 * 2. Inferencia estricta de tipos de TypeScript automática (z.infer<typeof Schema>).
 * 3. Mensajes de error declarativos y parseo seguro en un solo paso.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Error de validación de entrada',
          errors: error.errors.map((err) => ({
            campo: err.path.join('.'),
            mensaje: err.message,
          })),
        });
      }
      throw new BadRequestException('Error de validación');
    }
  }
}
