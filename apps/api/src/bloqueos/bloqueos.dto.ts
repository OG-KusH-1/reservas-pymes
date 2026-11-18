import {
  actualizarBloqueoSchema,
  consultaBloqueosSchema,
  crearBloqueoSchema,
} from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO de consulta para filtrar bloqueos por rango de fechas o profesional. */
export class ConsultaBloqueosDto extends createZodDto(consultaBloqueosSchema) {}

/** DTO de entrada para crear un bloqueo puntual de empresa o de profesional. */
export class CrearBloqueoDto extends createZodDto(crearBloqueoSchema) {}

/** DTO de entrada para actualizar parcialmente un bloqueo existente. */
export class ActualizarBloqueoDto extends createZodDto(actualizarBloqueoSchema) {}
