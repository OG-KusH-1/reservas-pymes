import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  reemplazarHorariosSchema,
  tramoHorarioSchema,
  type TramoHorario,
} from '@portfolio/contracts';
import { z } from 'zod';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles, SesionActual, type ContextoSesion } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { ReemplazarHorariosDto } from './horarios.dto.js';
import { HorariosService } from './horarios.service.js';

/**
 * Endpoints de gestión de horarios semanales por profesional
 * (`/api/v1/profesionales/:id/horarios`).
 *
 * Todos los roles autenticados pueden consultar los horarios; solo `dueno`,
 * `admin` y el propio `profesional` vinculado pueden modificarlos.
 */
@ApiTags('Horarios')
@ApiCookieAuth(COOKIE_SESION)
@Controller('profesionales')
export class HorariosController {
  constructor(private readonly horariosService: HorariosService) {}

  /**
   * `GET /api/v1/profesionales/:id/horarios`
   *
   * Lista los tramos horarios semanales de un profesional de la empresa activa.
   */
  @Get(':id/horarios')
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Listar horarios semanales de un profesional' })
  @ApiZodResponse(z.array(tramoHorarioSchema), {
    status: 200,
    description: 'Tramos horarios semanales del profesional',
  })
  @ApiErrores(401, 403, 404)
  listar(@EmpresaId() empresaId: string, @Param('id') id: string): Promise<TramoHorario[]> {
    return this.horariosService.listar(empresaId, id);
  }

  /**
   * `PUT /api/v1/profesionales/:id/horarios`
   *
   * Reemplaza de forma atómica los tramos horarios semanales de un profesional.
   */
  @Put(':id/horarios')
  @Roles('dueno', 'admin', 'profesional')
  @ApiOperation({ summary: 'Reemplazar horarios semanales de un profesional' })
  @ApiZodBody(reemplazarHorariosSchema)
  @ApiZodResponse(z.array(tramoHorarioSchema), {
    status: 200,
    description: 'Horarios semanales actualizados',
  })
  @ApiErrores(400, 401, 403, 404)
  reemplazar(
    @SesionActual() sesion: ContextoSesion,
    @Param('id') id: string,
    @Body() datos: ReemplazarHorariosDto,
  ): Promise<TramoHorario[]> {
    return this.horariosService.reemplazar(sesion, id, datos);
  }
}
