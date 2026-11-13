import { z } from 'zod';
import { correoSchema, idSchema, slugSchema } from './comunes.js';
import { rolMiembroSchema } from './dominio.js';

/**
 * Contrato de autenticación (endpoints bajo `/api/v1/auth`).
 *
 * | Método y ruta          | Entrada                | Éxito                  |
 * | ---------------------- | ---------------------- | ---------------------- |
 * | `POST /auth/registro`  | `registroSchema`       | 201 + `sesionSchema`   |
 * | `POST /auth/ingresar`  | `iniciarSesionSchema`  | 200 + `sesionSchema`   |
 * | `POST /auth/salir`     | —                      | 204                    |
 * | `GET /auth/sesion`     | —                      | 200 + `sesionSchema`   |
 *
 * Registro e ingreso dejan la cookie de sesión `httpOnly`; el token nunca
 * aparece en el cuerpo de la respuesta.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/**
 * Contraseña nueva. Se exige longitud y no reglas de composición (mayúsculas,
 * símbolos): la longitud es lo que más aporta y las reglas de composición
 * empujan a contraseñas predecibles. El máximo acota el costo del hash.
 */
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Debe tener al menos ${PASSWORD_MIN} caracteres`)
  .max(PASSWORD_MAX, `Debe tener como máximo ${PASSWORD_MAX} caracteres`);

const nombreSchema = z.string().trim().min(2, 'Debe tener al menos 2 caracteres').max(255);

/** Alta de una empresa junto con la cuenta de su dueño. */
export const registroSchema = z.object({
  nombreEmpresa: nombreSchema,
  /** Dirección pública de reservas: `/{slug}`. */
  slug: slugSchema,
  nombre: nombreSchema,
  email: correoSchema,
  password: passwordSchema,
});
export type Registro = z.infer<typeof registroSchema>;

/**
 * Inicio de sesión. La contraseña solo exige no estar vacía: aplicar aquí las
 * reglas de `passwordSchema` revelaría la política y bloquearía cuentas
 * creadas con una política anterior.
 */
export const iniciarSesionSchema = z.object({
  email: correoSchema,
  password: z.string().min(1, 'Ingresa tu contraseña').max(PASSWORD_MAX),
});
export type IniciarSesion = z.infer<typeof iniciarSesionSchema>;

/**
 * Sesión actual: quién es la persona, en qué empresa está trabajando y con
 * qué rol. Es todo lo que la web necesita para armar el panel y decidir qué
 * mostrar. No incluye datos sensibles.
 */
export const sesionSchema = z.object({
  usuario: z.object({
    id: idSchema,
    nombre: z.string(),
    email: z.string(),
    emailVerificado: z.boolean(),
  }),
  empresa: z.object({
    id: idSchema,
    nombre: z.string(),
    slug: z.string(),
    /** Zona IANA; la web la usa para mostrar todas las fechas. */
    zonaHoraria: z.string(),
    moneda: z.string(),
  }),
  rol: rolMiembroSchema,
});
export type Sesion = z.infer<typeof sesionSchema>;
