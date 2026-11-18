import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  actualizarBloqueoSchema,
  bloqueoSchema,
  crearBloqueoSchema,
  resultadoBloqueoSchema,
  type Bloqueo,
  type ResultadoBloqueo,
} from '@portfolio/contracts';
import { z } from 'zod';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles, SesionActual, type ContextoSesion } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { ActualizarBloqueoDto, ConsultaBloqueosDto, CrearBloqueoDto } from './bloqueos.dto.js';
import { BloqueosService } from './bloqueos.service.js';

/**
 * Endpoints de gestión de bloqueos puntuales de disponibilidad
 * (`/api/v1/bloqueos`).
 *
 * Todos los roles autenticados pueden consultar los bloqueos; `dueno` y `admin`
 * pueden gestionar bloqueos de empresa o de cualquier profesional, mientras que
 * `profesional` solo puede gestionar los suyos propios.
 */
@ApiTags('Bloqueos')
@ApiCookieAuth(COOKIE_SESION)
@Controller('bloqueos')
export class BloqueosController {
  constructor(private readonly bloqueosService: BloqueosService) {}

  /**
   * `GET /api/v1/bloqueos`
   *
   * Lista los bloqueos de la empresa activa filtrados por rango de fechas o profesional.
   */
  @Get()
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Listar bloqueos de disponibilidad' })
  @ApiZodResponse(z.array(bloqueoSchema), {
    status: 200,
    description: 'Listado de bloqueos ordenados por fecha de inicio',
  })
  @ApiErrores(400, 401, 403)
  listar(
    @EmpresaId() empresaId: string,
    @Query() consulta: ConsultaBloqueosDto,
  ): Promise<Bloqueo[]> {
    return this.bloqueosService.listar(empresaId, consulta);
  }

  /**
   * `POST /api/v1/bloqueos`
   *
   * Crea un bloqueo de empresa o de profesional y devuelve el conteo de
   * reservas activas afectadas.
   */
  @Post()
  @Roles('dueno', 'admin', 'profesional')
  @ApiOperation({ summary: 'Crear un bloqueo de disponibilidad' })
  @ApiZodBody(crearBloqueoSchema)
  @ApiZodResponse(resultadoBloqueoSchema, {
    status: 201,
    description: 'Bloqueo creado con conteo de reservas afectadas',
  })
  @ApiErrores(400, 401, 403, 404)
  crear(
    @SesionActual() sesion: ContextoSesion,
    @Body() datos: CrearBloqueoDto,
  ): Promise<ResultadoBloqueo> {
    return this.bloqueosService.crear(sesion, datos);
  }

  /**
   * `PATCH /api/v1/bloqueos/:id`
   *
   * Actualiza parcialmente un bloqueo existente y recalcula las reservas afectadas.
   */
  @Patch(':id')
  @Roles('dueno', 'admin', 'profesional')
  @ApiOperation({ summary: 'Actualizar un bloqueo de disponibilidad' })
  @ApiZodBody(actualizarBloqueoSchema)
  @ApiZodResponse(resultadoBloqueoSchema, {
    status: 200,
    description: 'Bloqueo actualizado con conteo de reservas afectadas',
  })
  @ApiErrores(400, 401, 403, 404)
  actualizar(
    @SesionActual() sesion: ContextoSesion,
    @Param('id') id: string,
    @Body() datos: ActualizarBloqueoDto,
  ): Promise<ResultadoBloqueo> {
    return this.bloqueosService.actualizar(sesion, id, datos);
  }

  /**
   * `DELETE /api/v1/bloqueos/:id`
   *
   * Elimina un bloqueo puntual de disponibilidad.
   */
  @Delete(':id')
  @Roles('dueno', 'admin', 'profesional')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un bloqueo de disponibilidad' })
  @ApiResponse({ status: 204, description: 'Bloqueo eliminado' })
  @ApiErrores(401, 403, 404)
  eliminar(@SesionActual() sesion: ContextoSesion, @Param('id') id: string): Promise<void> {
    return this.bloqueosService.eliminar(sesion, id);
  }
}
