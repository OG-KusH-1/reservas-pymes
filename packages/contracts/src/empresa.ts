import { z } from 'zod';
import {
  correoSchema,
  idSchema,
  instanteSchema,
  slugSchema,
  zonaHorariaSchema,
} from './comunes.js';

/**
 * Contrato de configuración de la empresa activa y sus políticas de reserva
 * (endpoints bajo `/api/v1/empresa`).
 *
 * | Método y ruta    | Entrada                   | Éxito            |
 * | ---------------- | ------------------------- | ---------------- |
 * | `GET /empresa`   | —                         | `empresaSchema`  |
 * | `PATCH /empresa` | `actualizarEmpresaSchema` | `empresaSchema`  |
 */

/** Datos públicos y políticas de reserva de la empresa activa en la sesión. */
export const empresaSchema = z.object({
  id: idSchema,
  nombre: z.string(),
  slug: z.string(),
  rut: z.string().nullable(),
  email: z.string().nullable(),
  telefono: z.string().nullable(),
  direccion: z.string().nullable(),
  /** Zona horaria IANA; define la hora local de horarios y reservas. */
  zonaHoraria: z.string(),
  /** Código ISO 4217 (ej. `CLP`). */
  moneda: z.string(),
  anticipacionMinimaMinutos: z.number().int(),
  anticipacionMaximaDias: z.number().int(),
  cancelacionMinimaMinutos: z.number().int(),
  intervaloGrillaMinutos: z.number().int(),
  confirmacionAutomatica: z.boolean(),
  recordatorioHorasAntes: z.number().int(),
  creadoEn: instanteSchema,
  actualizadoEn: instanteSchema,
});
export type Empresa = z.infer<typeof empresaSchema>;

/**
 * Actualización parcial de la empresa activa y sus políticas de reserva.
 *
 * Los rangos de las políticas reflejan directamente las restricciones `CHECK`
 * de la tabla `empresas` en la base de datos. Se exige al menos un campo para
 * preservar la semántica de `PATCH`.
 */
export const actualizarEmpresaSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255).optional(),
    slug: slugSchema.optional(),
    rut: z.string().trim().max(20, 'Máximo 20 caracteres').nullable().optional(),
    email: correoSchema.nullable().optional(),
    telefono: z.string().trim().max(50, 'Máximo 50 caracteres').nullable().optional(),
    direccion: z.string().trim().max(255, 'Máximo 255 caracteres').nullable().optional(),
    zonaHoraria: zonaHorariaSchema.optional(),
    moneda: z
      .string()
      .trim()
      .regex(/^[A-Z]{3}$/, 'Debe ser un código ISO 4217 de 3 letras en mayúsculas')
      .optional(),
    anticipacionMinimaMinutos: z.number().int().min(0, 'Debe ser 0 o mayor').optional(),
    anticipacionMaximaDias: z.number().int().min(1, 'Debe ser al menos 1 día').optional(),
    cancelacionMinimaMinutos: z.number().int().min(0, 'Debe ser 0 o mayor').optional(),
    intervaloGrillaMinutos: z
      .number()
      .int()
      .min(5, 'Mínimo 5 minutos')
      .max(120, 'Máximo 120 minutos')
      .optional(),
    confirmacionAutomatica: z.boolean().optional(),
    recordatorioHorasAntes: z.number().int().min(0, 'Debe ser 0 o mayor').optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debe enviar al menos un campo para actualizar',
  });
export type ActualizarEmpresa = z.infer<typeof actualizarEmpresaSchema>;
