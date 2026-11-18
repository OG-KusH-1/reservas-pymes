import { reemplazarHorariosSchema } from '@portfolio/contracts';
import { createZodDto } from '../common/zod/zod-dto.js';

/** DTO de entrada para reemplazar los tramos horarios semanales de un profesional. */
export class ReemplazarHorariosDto extends createZodDto(reemplazarHorariosSchema) {}
