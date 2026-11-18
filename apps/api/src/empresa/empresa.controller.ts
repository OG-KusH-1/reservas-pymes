import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { actualizarEmpresaSchema, empresaSchema, type Empresa } from '@portfolio/contracts';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { ActualizarEmpresaDto } from './empresa.dto.js';
import { EmpresaService } from './empresa.service.js';

/**
 * Endpoints de consulta y configuración de la empresa activa (`/api/v1/empresa`).
 *
 * Cualquier miembro autenticado puede leer el perfil y las políticas de
 * reserva de su empresa; solo `dueno` y `admin` pueden modificarlos.
 */
@ApiTags('Empresa')
@ApiCookieAuth(COOKIE_SESION)
@Controller('empresa')
export class EmpresaController {
  constructor(private readonly empresaService: EmpresaService) {}

  /**
   * `GET /api/v1/empresa`
   *
   * Devuelve el perfil y las políticas de reserva de la empresa activa en la sesión.
   */
  @Get()
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Obtener la configuración de la empresa activa' })
  @ApiZodResponse(empresaSchema, {
    status: 200,
    description: 'Configuración y políticas de la empresa activa',
  })
  @ApiErrores(401, 403, 404)
  obtener(@EmpresaId() empresaId: string): Promise<Empresa> {
    return this.empresaService.obtener(empresaId);
  }

  /**
   * `PATCH /api/v1/empresa`
   *
   * Actualiza parcialmente el perfil y/o las políticas de reserva de la empresa activa.
   */
  @Patch()
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Actualizar la configuración y políticas de la empresa activa' })
  @ApiZodBody(actualizarEmpresaSchema)
  @ApiZodResponse(empresaSchema, { status: 200, description: 'Empresa actualizada' })
  @ApiErrores(400, 401, 403, 404, 409)
  actualizar(
    @EmpresaId() empresaId: string,
    @Body() datos: ActualizarEmpresaDto,
  ): Promise<Empresa> {
    return this.empresaService.actualizar(empresaId, datos);
  }
}
