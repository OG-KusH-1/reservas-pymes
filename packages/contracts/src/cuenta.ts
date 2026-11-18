import { z } from 'zod';
import { PASSWORD_MAX, passwordSchema } from './auth.js';
import { correoSchema } from './comunes.js';

/**
 * Contrato de verificación de correo, recuperación y cambio de contraseña
 * (endpoints bajo `/api/v1`).
 *
 * | Método y ruta                   | Entrada                       | Éxito |
 * | ------------------------------- | ----------------------------- | ----- |
 * | `POST /auth/verificar-correo/enviar` | —                        | 204   |
 * | `POST /publico/verificar-correo`     | `verificarCorreoSchema`   | 204   |
 * | `POST /publico/recuperar`            | `solicitarRecuperacionSchema` | 204 |
 * | `POST /publico/restablecer`          | `restablecerContrasenaSchema` | 204 |
 * | `POST /auth/cambiar-contrasena`      | `cambiarContrasenaSchema` | 204   |
 */

const tokenSchema = z.string().trim().min(1, 'Token requerido').max(256);

/** Confirmación del correo mediante el token de un solo uso enviado por email. */
export const verificarCorreoSchema = z.object({
  token: tokenSchema,
});
export type VerificarCorreo = z.infer<typeof verificarCorreoSchema>;

/** Solicitud de correo de recuperación de contraseña. */
export const solicitarRecuperacionSchema = z.object({
  email: correoSchema,
});
export type SolicitarRecuperacion = z.infer<typeof solicitarRecuperacionSchema>;

/** Restablecimiento de contraseña usando el token de recuperación. */
export const restablecerContrasenaSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});
export type RestablecerContrasena = z.infer<typeof restablecerContrasenaSchema>;

/**
 * Cambio de contraseña desde una sesión activa. `passwordActual` solo exige
 * no estar vacía por la misma razón que `iniciarSesionSchema`: no bloquear
 * cuentas creadas con una política anterior.
 */
export const cambiarContrasenaSchema = z.object({
  passwordActual: z.string().min(1, 'Ingresa tu contraseña actual').max(PASSWORD_MAX),
  passwordNueva: passwordSchema,
});
export type CambiarContrasena = z.infer<typeof cambiarContrasenaSchema>;
