import { iniciarSesionSchema, registroSchema } from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO validado para `POST /api/v1/auth/registro`. */
export class RegistroDto extends createZodDto(registroSchema) {}

/** DTO validado para `POST /api/v1/auth/ingresar`. */
export class IniciarSesionDto extends createZodDto(iniciarSesionSchema) {}
