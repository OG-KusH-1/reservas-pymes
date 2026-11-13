import { z } from 'zod';

/**
 * Enumeraciones del dominio compartidas por la API, la base de datos y la web.
 *
 * Cada enumeración se declara como tupla `as const` y de ella se derivan el
 * esquema Zod y el tipo de TypeScript. La API reutiliza la misma tupla para
 * crear el `pgEnum` de PostgreSQL (ver `apps/api/src/db/schema`), de modo que
 * agregar un valor aquí es el único cambio de código necesario; después hay
 * que generar la migración con `pnpm db:generate`.
 *
 * Los valores están en español y sin tildes porque se guardan tal cual en la
 * base de datos y viajan en las URL.
 */

/** Roles de un miembro dentro de una empresa, de mayor a menor privilegio. */
export const ROLES_MIEMBRO = ['dueno', 'admin', 'recepcion', 'profesional'] as const;
export const rolMiembroSchema = z.enum(ROLES_MIEMBRO);
export type RolMiembro = z.infer<typeof rolMiembroSchema>;

/**
 * Ciclo de vida de una reserva.
 *
 * - `pendiente`: creada, a la espera de confirmación de la empresa.
 * - `confirmada`: la hora está tomada en firme.
 * - `cancelada`: libera la hora (queda fuera de la restricción antisolape).
 * - `completada`: la atención se realizó.
 * - `no_asistio`: el cliente no llegó; cuenta para los indicadores.
 */
export const ESTADOS_RESERVA = [
  'pendiente',
  'confirmada',
  'cancelada',
  'completada',
  'no_asistio',
] as const;
export const estadoReservaSchema = z.enum(ESTADOS_RESERVA);
export type EstadoReserva = z.infer<typeof estadoReservaSchema>;

/**
 * Transiciones de estado permitidas. Es la única fuente de verdad: la API la
 * usa para validar y la web para decidir qué acciones mostrar.
 * Los estados finales (`cancelada`, `completada`, `no_asistio`) no tienen salida.
 */
export const TRANSICIONES_RESERVA: Readonly<Record<EstadoReserva, readonly EstadoReserva[]>> = {
  pendiente: ['confirmada', 'cancelada'],
  confirmada: ['cancelada', 'completada', 'no_asistio'],
  cancelada: [],
  completada: [],
  no_asistio: [],
};

/** Indica si una reserva puede pasar de un estado a otro. */
export function puedeTransicionar(desde: EstadoReserva, hacia: EstadoReserva): boolean {
  return TRANSICIONES_RESERVA[desde].includes(hacia);
}

/** Desde dónde se creó la reserva: el panel interno o la página pública. */
export const ORIGENES_RESERVA = ['panel', 'publico'] as const;
export const origenReservaSchema = z.enum(ORIGENES_RESERVA);
export type OrigenReserva = z.infer<typeof origenReservaSchema>;

/** Canales de notificación. `whatsapp` queda reservado para la Fase 8. */
export const CANALES_NOTIFICACION = ['correo', 'whatsapp'] as const;
export const canalNotificacionSchema = z.enum(CANALES_NOTIFICACION);
export type CanalNotificacion = z.infer<typeof canalNotificacionSchema>;

export const ESTADOS_NOTIFICACION = ['pendiente', 'enviada', 'fallida'] as const;
export const estadoNotificacionSchema = z.enum(ESTADOS_NOTIFICACION);
export type EstadoNotificacion = z.infer<typeof estadoNotificacionSchema>;

/** Usos de un token de un solo uso enviado por correo. */
export const TIPOS_TOKEN = ['verificar_correo', 'recuperar_contrasena'] as const;
export const tipoTokenSchema = z.enum(TIPOS_TOKEN);
export type TipoToken = z.infer<typeof tipoTokenSchema>;
