import { z } from 'zod';
import { passwordSchema } from './auth.js';
import { correoSchema, idSchema, instanteSchema } from './comunes.js';
import { rolMiembroSchema } from './dominio.js';

/**
 * Contrato de miembros, invitaciones y cambio de empresa activa
 * (endpoints bajo `/api/v1`).
 *
 * | Método y ruta                                 | Entrada                       | Éxito                                  |
 * | --------------------------------------------- | ----------------------------- | -------------------------------------- |
 * | `GET /miembros`                               | —                             | 200 + `miembroSchema[]`                |
 * | `PATCH /miembros/:id`                         | `actualizarMiembroSchema`     | 200 + `miembroSchema`                  |
 * | `DELETE /miembros/:id`                        | —                             | 204                                    |
 * | `GET /invitaciones`                           | —                             | 200 + `invitacionSchema[]`             |
 * | `POST /invitaciones`                          | `crearInvitacionSchema`       | 201 + `invitacionSchema`               |
 * | `DELETE /invitaciones/:id`                    | —                             | 204                                    |
 * | `GET /publico/invitaciones/:token`            | —                             | 200 + `detalleInvitacionPublicaSchema` |
 * | `POST /publico/invitaciones/:token/aceptar`   | `aceptarInvitacionSchema`     | 200 + `sesionSchema`                   |
 * | `GET /auth/empresas`                          | —                             | 200 + `empresaDeUsuarioSchema[]`       |
 * | `POST /auth/empresa-activa`                   | `cambiarEmpresaActivaSchema`  | 200 + `sesionSchema`                   |
 */

/** Miembro de la empresa activa con los datos públicos de su usuario. */
export const miembroSchema = z.object({
  id: idSchema,
  usuarioId: idSchema,
  nombre: z.string(),
  email: z.string(),
  rol: rolMiembroSchema,
  activo: z.boolean(),
  emailVerificado: z.boolean(),
  creadoEn: instanteSchema,
});
export type Miembro = z.infer<typeof miembroSchema>;

/**
 * Actualización parcial de un miembro. Se exige al menos un campo para
 * evitar mutaciones vacías y preservar la semántica de `PATCH`.
 */
export const actualizarMiembroSchema = z
  .object({
    rol: rolMiembroSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((datos) => datos.rol !== undefined || datos.activo !== undefined, {
    message: 'Debe indicar al menos el rol o el estado activo',
  });
export type ActualizarMiembro = z.infer<typeof actualizarMiembroSchema>;

/** Invitación pendiente para sumarse a la empresa activa. */
export const invitacionSchema = z.object({
  id: idSchema,
  email: z.string(),
  rol: rolMiembroSchema,
  expiraEn: instanteSchema,
  creadoEn: instanteSchema,
});
export type Invitacion = z.infer<typeof invitacionSchema>;

/** Datos para crear y enviar una invitación por correo. */
export const crearInvitacionSchema = z.object({
  email: correoSchema,
  rol: rolMiembroSchema,
});
export type CrearInvitacion = z.infer<typeof crearInvitacionSchema>;

/**
 * Datos mínimos de una invitación consultada por token público.
 * `usuarioExiste` permite que la web decida si pedir nombre y contraseña
 * para crear cuenta o pedir que inicie sesión con su cuenta existente.
 */
export const detalleInvitacionPublicaSchema = z.object({
  email: z.string(),
  rol: rolMiembroSchema,
  empresaNombre: z.string(),
  usuarioExiste: z.boolean(),
  expiraEn: instanteSchema,
});
export type DetalleInvitacionPublica = z.infer<typeof detalleInvitacionPublicaSchema>;

/**
 * Aceptación de una invitación.
 * Si el correo aún no tiene cuenta, se exigen `nombre` y `password` en el
 * servicio; si ya existe y tiene sesión activa con ese correo, basta `{}`.
 */
export const aceptarInvitacionSchema = z.object({
  nombre: z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255).optional(),
  password: passwordSchema.optional(),
});
export type AceptarInvitacion = z.infer<typeof aceptarInvitacionSchema>;

/** Empresa a la que pertenece el usuario autenticado. */
export const empresaDeUsuarioSchema = z.object({
  id: idSchema,
  nombre: z.string(),
  slug: z.string(),
  rol: rolMiembroSchema,
  /** Indica si es la empresa activa en la sesión actual. */
  activa: z.boolean(),
});
export type EmpresaDeUsuario = z.infer<typeof empresaDeUsuarioSchema>;

/** Solicitud de cambio de empresa activa dentro de la sesión actual. */
export const cambiarEmpresaActivaSchema = z.object({
  empresaId: idSchema,
});
export type CambiarEmpresaActiva = z.infer<typeof cambiarEmpresaActivaSchema>;
