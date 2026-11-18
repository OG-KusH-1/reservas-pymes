import { z } from 'zod';
import { booleanoConsultaSchema, correoSchema, idSchema, instanteSchema } from './comunes.js';
import { consultaPaginadaSchema, paginaSchema } from './paginacion.js';

/**
 * Contrato de profesionales y asignación de servicios/usuarios de la empresa
 * activa (endpoints bajo `/api/v1/profesionales`).
 *
 * | Método y ruta                    | Entrada                              | Éxito                        |
 * | -------------------------------- | ------------------------------------ | ---------------------------- |
 * | `GET /profesionales`             | `consultaProfesionalesSchema`        | `paginaProfesionalesSchema`  |
 * | `GET /profesionales/:id`         | —                                    | `profesionalSchema`          |
 * | `POST /profesionales`            | `crearProfesionalSchema`             | 201 + `profesionalSchema`    |
 * | `PATCH /profesionales/:id`       | `actualizarProfesionalSchema`        | `profesionalSchema`          |
 * | `DELETE /profesionales/:id`      | —                                    | 204                          |
 * | `PUT /profesionales/:id/servicios`| `asignarServiciosProfesionalSchema` | `profesionalSchema`          |
 * | `PUT /profesionales/:id/usuario` | `vincularUsuarioProfesionalSchema`   | `profesionalSchema`          |
 */

/** Resumen de un servicio asignado a un profesional. */
export const servicioDeProfesionalSchema = z.object({
  id: idSchema,
  nombre: z.string(),
  color: z.string().nullable(),
  activo: z.boolean(),
});
export type ServicioDeProfesional = z.infer<typeof servicioDeProfesionalSchema>;

/** Profesional de la empresa activa con los servicios que atiende. */
export const profesionalSchema = z.object({
  id: idSchema,
  /** Cuenta del panel vinculada al profesional, o `null` si no tiene acceso. */
  usuarioId: idSchema.nullable(),
  nombre: z.string(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  activo: z.boolean(),
  servicios: z.array(servicioDeProfesionalSchema),
  creadoEn: instanteSchema,
  actualizadoEn: instanteSchema,
});
export type Profesional = z.infer<typeof profesionalSchema>;

/** Parámetros de consulta para filtrar y paginar el listado de profesionales. */
export const consultaProfesionalesSchema = consultaPaginadaSchema.extend({
  activo: booleanoConsultaSchema.optional(),
  servicioId: idSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export type ConsultaProfesionales = z.infer<typeof consultaProfesionalesSchema>;

/** Página de resultados de profesionales. */
export const paginaProfesionalesSchema = paginaSchema(profesionalSchema);
export type PaginaProfesionales = z.infer<typeof paginaProfesionalesSchema>;

/** Datos para registrar un nuevo profesional en la empresa activa. */
export const crearProfesionalSchema = z.object({
  nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255),
  email: correoSchema.nullable().optional(),
  telefono: z.string().trim().max(50, 'Máximo 50 caracteres').nullable().optional(),
  activo: z.boolean().default(true),
});
export type CrearProfesional = z.infer<typeof crearProfesionalSchema>;

/**
 * Actualización parcial de un profesional existente. Se exige al menos un campo
 * para preservar la semántica de `PATCH`.
 */
export const actualizarProfesionalSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255).optional(),
    email: correoSchema.nullable().optional(),
    telefono: z.string().trim().max(50, 'Máximo 50 caracteres').nullable().optional(),
    activo: z.boolean().optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debe enviar al menos un campo para actualizar',
  });
export type ActualizarProfesional = z.infer<typeof actualizarProfesionalSchema>;

/**
 * Reemplazo atómico de los servicios que atiende un profesional.
 * Una lista vacía desasigna todos sus servicios.
 */
export const asignarServiciosProfesionalSchema = z.object({
  servicioIds: z.array(idSchema),
});
export type AsignarServiciosProfesional = z.infer<typeof asignarServiciosProfesionalSchema>;

/**
 * Vínculo o desvínculo de un profesional con una cuenta de usuario miembro de
 * la misma empresa (`null` para desvincular).
 */
export const vincularUsuarioProfesionalSchema = z.object({
  usuarioId: idSchema.nullable(),
});
export type VincularUsuarioProfesional = z.infer<typeof vincularUsuarioProfesionalSchema>;
