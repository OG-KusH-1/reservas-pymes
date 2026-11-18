import {
  actualizarServicioSchema,
  consultaServiciosSchema,
  crearServicioSchema,
} from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO de consulta para filtrar y paginar el listado de servicios. */
export class ConsultaServiciosDto extends createZodDto(consultaServiciosSchema) {}

/** DTO de entrada para crear un servicio en el catálogo de la empresa activa. */
export class CrearServicioDto extends createZodDto(crearServicioSchema) {}

/** DTO de entrada para actualizar parcialmente un servicio existente. */
export class ActualizarServicioDto extends createZodDto(actualizarServicioSchema) {}
