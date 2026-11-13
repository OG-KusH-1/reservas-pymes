import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiResponse, type ApiResponseSchemaHost } from '@nestjs/swagger';
import { errorApiSchema } from '@portfolio/contracts';
import { z } from 'zod';

type EsquemaOpenApi = ApiResponseSchemaHost['schema'];

/**
 * Convierte un esquema Zod al formato de esquema de OpenAPI 3.0.
 *
 * `io` distingue la forma de entrada (lo que envía el cliente, antes de
 * valores por defecto y transformaciones) de la de salida (lo que responde la
 * API). `unrepresentable: 'any'` evita que un tipo sin equivalente en JSON
 * Schema (una transformación, por ejemplo) rompa el arranque: se documenta
 * como «cualquier valor».
 */
function aOpenApi(schema: z.ZodType, io: 'input' | 'output'): EsquemaOpenApi {
  const { $schema: _version, ...resto } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  });
  return resto as EsquemaOpenApi;
}

/**
 * Documenta en OpenAPI el cuerpo de la petición a partir del esquema Zod.
 * La validación la hace el `ZodValidationPipe`; este decorador solo documenta.
 *
 * @example
 * @Post()
 * @ApiZodBody(crearServicioSchema)
 * crear(@Body() datos: CrearServicioDto) { ... }
 */
export function ApiZodBody(schema: z.ZodType): MethodDecorator {
  return ApiBody({ schema: aOpenApi(schema, 'input') });
}

/**
 * Documenta una respuesta exitosa a partir del esquema Zod de salida.
 *
 * @example
 * @ApiZodResponse(servicioSchema, { status: 201, description: 'Servicio creado' })
 */
export function ApiZodResponse(
  schema: z.ZodType,
  opciones: { status?: number; description?: string } = {},
): MethodDecorator {
  return ApiResponse({
    status: opciones.status ?? 200,
    description: opciones.description,
    schema: aOpenApi(schema, 'output'),
  });
}

/**
 * Documenta las respuestas de error posibles de un endpoint, todas con la
 * forma estándar `ErrorApi`.
 *
 * @example
 * @ApiErrores(400, 401, 404)
 */
export function ApiErrores(...estados: number[]): MethodDecorator {
  const schema = aOpenApi(errorApiSchema, 'output');
  return applyDecorators(...estados.map((status) => ApiResponse({ status, schema })));
}
