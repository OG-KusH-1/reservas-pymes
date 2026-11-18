import { actualizarEmpresaSchema } from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/**
 * DTO de entrada para `PATCH /api/v1/empresa`.
 *
 * Valida parcialmente los datos del perfil de la empresa y sus políticas de
 * reserva usando el contrato compartido `@portfolio/contracts`.
 */
export class ActualizarEmpresaDto extends createZodDto(actualizarEmpresaSchema) {}
