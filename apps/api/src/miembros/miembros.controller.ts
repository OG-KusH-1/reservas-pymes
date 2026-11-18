import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { miembroSchema, actualizarMiembroSchema, type Miembro } from '@portfolio/contracts';
import { z } from 'zod';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles, SesionActual, type ContextoSesion } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { ActualizarMiembroDto } from './miembros.dto.js';
import { MiembrosService } from './miembros.service.js';

/**
 * Endpoints de gestión del equipo de la empresa activa (`/api/v1/miembros`).
 *
 * Todos los roles autenticados pueden consultar la lista de miembros; solo
 * `dueno` y `admin` pueden modificar roles, activar/desactivar o eliminar.
 */
@ApiTags('Miembros')
@ApiCookieAuth(COOKIE_SESION)
@Controller('miembros')
export class MiembrosController {
  constructor(private readonly miembrosService: MiembrosService) {}

  /**
   * `GET /api/v1/miembros`
   *
   * Lista los miembros de la empresa activa.
   */
  @Get()
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Listar los miembros de la empresa activa' })
  @ApiZodResponse(z.array(miembroSchema), { status: 200, description: 'Lista de miembros' })
  @ApiErrores(401, 403)
  listar(@EmpresaId() empresaId: string): Promise<Miembro[]> {
    return this.miembrosService.listar(empresaId);
  }

  /**
   * `PATCH /api/v1/miembros/:id`
   *
   * Cambia el rol o estado activo de un miembro de la empresa activa.
   */
  @Patch(':id')
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Actualizar el rol o estado de un miembro' })
  @ApiZodBody(actualizarMiembroSchema)
  @ApiZodResponse(miembroSchema, { status: 200, description: 'Miembro actualizado' })
  @ApiErrores(400, 401, 403, 404, 409)
  actualizar(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() datos: ActualizarMiembroDto,
    @SesionActual() actor: ContextoSesion,
  ): Promise<Miembro> {
    return this.miembrosService.actualizar(empresaId, id, datos, actor);
  }

  /**
   * `DELETE /api/v1/miembros/:id`
   *
   * Elimina un miembro de la empresa activa y revoca sus sesiones en ella.
   */
  @Delete(':id')
  @Roles('dueno', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un miembro de la empresa activa' })
  @ApiResponse({ status: 204, description: 'Miembro eliminado' })
  @ApiErrores(401, 403, 404, 409)
  eliminar(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @SesionActual() actor: ContextoSesion,
  ): Promise<void> {
    return this.miembrosService.eliminar(empresaId, id, actor);
  }
}
