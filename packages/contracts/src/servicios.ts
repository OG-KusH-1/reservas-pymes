import { z } from 'zod';
import { booleanoConsultaSchema, idSchema, instanteSchema, montoSchema } from './comunes.js';
import { consultaPaginadaSchema, paginaSchema } from './paginacion.js';

/**
 * Contrato del catálogo de servicios de la empresa activa
 * (endpoints bajo `/api/v1/servicios`).
 *
 * | Método y ruta          | Entrada                    | Éxito                   |
 * | ---------------------- | -------------------------- | ----------------------- |
 * | `GET /servicios`       | `consultaServiciosSchema`  | `paginaServiciosSchema` |
 * | `GET /servicios/:id`   | —                          | `servicioSchema`        |
 * | `POST /servicios`      | `crearServicioSchema`      | 201 + `servicioSchema`  |
 * | `PATCH /servicios/:id` | `actualizarServicioSchema` | `servicioSchema`        |
 * | `DELETE /servicios/:id`| —                          | 204                     |
 */

/** Color hexadecimal `#RRGGBB` para distinguir el servicio en la agenda. */
export const colorServicioSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Debe ser un color hexadecimal (#RRGGBB)');

/** Servicio perteneciente al catálogo de la empresa activa. */
export const servicioSchema = z.object({
  id: idSchema,
  nombre: z.string(),
  descripcion: z.string().nullable(),
  categoria: z.string().nullable(),
  duracionMinutos: z.number().int(),
  margenPosteriorMinutos: z.number().int(),
  precio: montoSchema,
  visiblePublico: z.boolean(),
  color: z.string().nullable(),
  activo: z.boolean(),
  creadoEn: instanteSchema,
  actualizadoEn: instanteSchema,
});
export type Servicio = z.infer<typeof servicioSchema>;

/** Parámetros de consulta para filtrar y paginar el listado de servicios. */
export const consultaServiciosSchema = consultaPaginadaSchema.extend({
  activo: booleanoConsultaSchema.optional(),
  categoria: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().min(1).max(100).optional(),
});
export type ConsultaServicios = z.infer<typeof consultaServiciosSchema>;

/** Página de resultados de servicios. */
export const paginaServiciosSchema = paginaSchema(servicioSchema);
export type PaginaServicios = z.infer<typeof paginaServiciosSchema>;

/** Datos para crear un nuevo servicio en el catálogo de la empresa activa. */
export const crearServicioSchema = z.object({
  nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255),
  descripcion: z.string().trim().max(2000, 'Máximo 2000 caracteres').nullable().optional(),
  categoria: z.string().trim().min(1, 'No puede estar vacía').max(100).nullable().optional(),
  duracionMinutos: z
    .number()
    .int()
    .min(1, 'Debe durar al menos 1 minuto')
    .max(1440, 'Máximo 1440 minutos')
    .default(30),
  margenPosteriorMinutos: z
    .number()
    .int()
    .min(0, 'Debe ser 0 o mayor')
    .max(480, 'Máximo 480 minutos')
    .default(0),
  precio: montoSchema.default(0),
  visiblePublico: z.boolean().default(true),
  color: colorServicioSchema.nullable().optional(),
  activo: z.boolean().default(true),
});
export type CrearServicio = z.infer<typeof crearServicioSchema>;

/**
 * Actualización parcial de un servicio existente. Se exige al menos un campo
 * para preservar la semántica de `PATCH`.
 */
export const actualizarServicioSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255).optional(),
    descripcion: z.string().trim().max(2000, 'Máximo 2000 caracteres').nullable().optional(),
    categoria: z.string().trim().min(1, 'No puede estar vacía').max(100).nullable().optional(),
    duracionMinutos: z
      .number()
      .int()
      .min(1, 'Debe durar al menos 1 minuto')
      .max(1440, 'Máximo 1440 minutos')
      .optional(),
    margenPosteriorMinutos: z
      .number()
      .int()
      .min(0, 'Debe ser 0 o mayor')
      .max(480, 'Máximo 480 minutos')
      .optional(),
    precio: montoSchema.optional(),
    visiblePublico: z.boolean().optional(),
    color: colorServicioSchema.nullable().optional(),
    activo: z.boolean().optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debe enviar al menos un campo para actualizar',
  });
export type ActualizarServicio = z.infer<typeof actualizarServicioSchema>;
