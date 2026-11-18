import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  cambiarEmpresaActivaSchema,
  empresaDeUsuarioSchema,
  sesionSchema,
  type EmpresaDeUsuario,
  type Sesion,
} from '@portfolio/contracts';
import { z } from 'zod';
import { COOKIE_SESION } from '../app.setup.js';
import { SesionActual, type ContextoSesion } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { CambiarEmpresaActivaDto } from './miembros.dto.js';
import { MiembrosService } from './miembros.service.js';

/**
 * Endpoints de selección de empresa del usuario autenticado bajo `/api/v1/auth`.
 *
 * Viven en `MiembrosModule` (y no en `apps/api/src/auth/`) para evitar
 * colisiones entre tareas paralelas; Nest expone ambos bajo el prefijo `auth`.
 */
@ApiTags('Autenticación')
@ApiCookieAuth(COOKIE_SESION)
@Controller('auth')
export class EmpresasUsuarioController {
  constructor(private readonly miembrosService: MiembrosService) {}

  /**
   * `GET /api/v1/auth/empresas`
   *
   * Lista todas las empresas activas donde el usuario autenticado tiene
   * membresía activa, indicando cuál es la empresa activa en su sesión.
   */
  @Get('empresas')
  @ApiOperation({ summary: 'Listar empresas a las que pertenece el usuario' })
  @ApiZodResponse(z.array(empresaDeUsuarioSchema), {
    status: 200,
    description: 'Empresas del usuario',
  })
  @ApiErrores(401)
  listarEmpresas(@SesionActual() actor: ContextoSesion): Promise<EmpresaDeUsuario[]> {
    return this.miembrosService.listarEmpresasDeUsuario(actor);
  }

  /**
   * `POST /api/v1/auth/empresa-activa`
   *
   * Cambia la empresa activa (`sesiones.empresa_id`) de la sesión actual sin
   * necesidad de volver a iniciar sesión.
   */
  @Post('empresa-activa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cambiar la empresa activa de la sesión actual' })
  @ApiZodBody(cambiarEmpresaActivaSchema)
  @ApiZodResponse(sesionSchema, { status: 200, description: 'Empresa activa actualizada' })
  @ApiErrores(400, 401, 404)
  cambiarEmpresaActiva(
    @Body() datos: CambiarEmpresaActivaDto,
    @SesionActual() actor: ContextoSesion,
  ): Promise<Sesion> {
    return this.miembrosService.cambiarEmpresaActiva(datos.empresaId, actor);
  }
}
