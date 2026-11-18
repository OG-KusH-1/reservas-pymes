import {
  actualizarProfesionalSchema,
  asignarServiciosProfesionalSchema,
  consultaProfesionalesSchema,
  crearProfesionalSchema,
  vincularUsuarioProfesionalSchema,
} from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO de consulta para filtrar y paginar el listado de profesionales. */
export class ConsultaProfesionalesDto extends createZodDto(consultaProfesionalesSchema) {}

/** DTO para registrar un nuevo profesional en la empresa activa. */
export class CrearProfesionalDto extends createZodDto(crearProfesionalSchema) {}

/** DTO para actualizar parcialmente un profesional existente. */
export class ActualizarProfesionalDto extends createZodDto(actualizarProfesionalSchema) {}

/** DTO para reemplazar atómicamente los servicios que atiende un profesional. */
export class AsignarServiciosProfesionalDto extends createZodDto(
  asignarServiciosProfesionalSchema,
) {}

/** DTO para vincular o desvincular un profesional con una cuenta miembro de la empresa. */
export class VincularUsuarioProfesionalDto extends createZodDto(vincularUsuarioProfesionalSchema) {}
