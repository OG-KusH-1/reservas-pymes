import {
  aceptarInvitacionSchema,
  actualizarMiembroSchema,
  cambiarEmpresaActivaSchema,
  crearInvitacionSchema,
} from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO validado para actualizar el rol o estado activo de un miembro. */
export class ActualizarMiembroDto extends createZodDto(actualizarMiembroSchema) {}

/** DTO validado para crear y enviar una invitación a la empresa activa. */
export class CrearInvitacionDto extends createZodDto(crearInvitacionSchema) {}

/** DTO validado para aceptar una invitación pública (con cuenta nueva o existente). */
export class AceptarInvitacionDto extends createZodDto(aceptarInvitacionSchema) {}

/** DTO validado para cambiar la empresa activa dentro de la sesión actual. */
export class CambiarEmpresaActivaDto extends createZodDto(cambiarEmpresaActivaSchema) {}
