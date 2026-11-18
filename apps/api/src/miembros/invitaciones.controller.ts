import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { crearInvitacionSchema, invitacionSchema, type Invitacion } from '@portfolio/contracts';
import { z } from 'zod';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles, SesionActual, type ContextoSesion } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { InvitacionesService } from './invitaciones.service.js';
import { CrearInvitacionDto } from './miembros.dto.js';

/**
 * Endpoints internos de gestión de invitaciones de la empresa activa
 * (`/api/v1/invitaciones`).
 *
 * Todos los roles autenticados pueden listar las invitaciones pendientes;
 * solo `dueno` y `admin` pueden emitir nuevas invitaciones o revocarlas.
 */
@ApiTags('Invitaciones')
@ApiCookieAuth(COOKIE_SESION)
@Controller('invitaciones')
export class InvitacionesController {
  constructor(private readonly invitacionesService: InvitacionesService) {}

  /**
   * `GET /api/v1/invitaciones`
   *
   * Lista las invitaciones pendientes de la empresa activa.
   */
  @Get()
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Listar invitaciones pendientes de la empresa activa' })
  @ApiZodResponse(z.array(invitacionSchema), {
    status: 200,
    description: 'Invitaciones pendientes',
  })
  @ApiErrores(401, 403)
  listar(@EmpresaId() empresaId: string): Promise<Invitacion[]> {
    return this.invitacionesService.listar(empresaId);
  }

  /**
   * `POST /api/v1/invitaciones`
   *
   * Crea y envía por correo una invitación para sumarse a la empresa activa.
   */
  @Post()
  @Roles('dueno', 'admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear y enviar una invitación' })
  @ApiZodBody(crearInvitacionSchema)
  @ApiZodResponse(invitacionSchema, { status: 201, description: 'Invitación creada y enviada' })
  @ApiErrores(400, 401, 403, 409)
  crear(
    @EmpresaId() empresaId: string,
    @Body() datos: CrearInvitacionDto,
    @SesionActual() actor: ContextoSesion,
  ): Promise<Invitacion> {
    return this.invitacionesService.crear(empresaId, datos, actor);
  }

  /**
   * `DELETE /api/v1/invitaciones/:id`
   *
   * Revoca una invitación pendiente de la empresa activa.
   */
  @Delete(':id')
  @Roles('dueno', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revocar una invitación' })
  @ApiResponse({ status: 204, description: 'Invitación revocada' })
  @ApiErrores(401, 403, 404)
  revocar(@EmpresaId() empresaId: string, @Param('id') id: string): Promise<void> {
    return this.invitacionesService.revocar(empresaId, id);
  }
}
