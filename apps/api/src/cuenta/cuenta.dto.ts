import {
  cambiarContrasenaSchema,
  restablecerContrasenaSchema,
  solicitarRecuperacionSchema,
  verificarCorreoSchema,
} from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO validado para `POST /api/v1/publico/verificar-correo`. */
export class VerificarCorreoDto extends createZodDto(verificarCorreoSchema) {}

/** DTO validado para `POST /api/v1/publico/recuperar`. */
export class SolicitarRecuperacionDto extends createZodDto(solicitarRecuperacionSchema) {}

/** DTO validado para `POST /api/v1/publico/restablecer`. */
export class RestablecerContrasenaDto extends createZodDto(restablecerContrasenaSchema) {}

/** DTO validado para `POST /api/v1/auth/cambiar-contrasena`. */
export class CambiarContrasenaDto extends createZodDto(cambiarContrasenaSchema) {}
