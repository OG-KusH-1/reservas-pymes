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
  Put,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  actualizarProfesionalSchema,
  asignarServiciosProfesionalSchema,
  crearProfesionalSchema,
  paginaProfesionalesSchema,
  profesionalSchema,
  vincularUsuarioProfesionalSchema,
  type PaginaProfesionales,
  type Profesional,
} from '@portfolio/contracts';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import {
  ActualizarProfesionalDto,
  AsignarServiciosProfesionalDto,
  ConsultaProfesionalesDto,
  CrearProfesionalDto,
  VincularUsuarioProfesionalDto,
} from './profesionales.dto.js';
import { ProfesionalesService } from './profesionales.service.js';

/**
 * Endpoints de gestión de profesionales de la empresa activa (`/api/v1/profesionales`).
 *
 * Todos los roles autenticados pueden consultar el listado y el detalle; solo
 * `dueno` y `admin` pueden crear, editar, eliminar, asignar servicios o
 * vincular una cuenta de usuario.
 */
@ApiTags('Profesionales')
@ApiCookieAuth(COOKIE_SESION)
@Controller('profesionales')
export class ProfesionalesController {
  constructor(private readonly profesionalesService: ProfesionalesService) {}

  /**
   * `GET /api/v1/profesionales`
   *
   * Lista los profesionales de la empresa activa con paginación por cursor y filtros.
   */
  @Get()
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Listar profesionales de la empresa activa' })
  @ApiZodResponse(paginaProfesionalesSchema, {
    status: 200,
    description: 'Página de profesionales',
  })
  @ApiErrores(400, 401, 403)
  listar(
    @EmpresaId() empresaId: string,
    @Query() consulta: ConsultaProfesionalesDto,
  ): Promise<PaginaProfesionales> {
    return this.profesionalesService.listar(empresaId, consulta);
  }

  /**
   * `GET /api/v1/profesionales/:id`
   *
   * Obtiene el detalle de un profesional de la empresa activa.
   */
  @Get(':id')
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Obtener un profesional por su identificador' })
  @ApiZodResponse(profesionalSchema, { status: 200, description: 'Detalle del profesional' })
  @ApiErrores(401, 403, 404)
  obtener(@EmpresaId() empresaId: string, @Param('id') id: string): Promise<Profesional> {
    return this.profesionalesService.obtener(empresaId, id);
  }

  /**
   * `POST /api/v1/profesionales`
   *
   * Registra un nuevo profesional en la empresa activa.
   */
  @Post()
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Crear un profesional' })
  @ApiZodBody(crearProfesionalSchema)
  @ApiZodResponse(profesionalSchema, { status: 201, description: 'Profesional creado' })
  @ApiErrores(400, 401, 403)
  crear(@EmpresaId() empresaId: string, @Body() datos: CrearProfesionalDto): Promise<Profesional> {
    return this.profesionalesService.crear(empresaId, datos);
  }

  /**
   * `PATCH /api/v1/profesionales/:id`
   *
   * Modifica parcialmente los datos de un profesional de la empresa activa.
   */
  @Patch(':id')
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Actualizar un profesional' })
  @ApiZodBody(actualizarProfesionalSchema)
  @ApiZodResponse(profesionalSchema, { status: 200, description: 'Profesional actualizado' })
  @ApiErrores(400, 401, 403, 404)
  actualizar(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() datos: ActualizarProfesionalDto,
  ): Promise<Profesional> {
    return this.profesionalesService.actualizar(empresaId, id, datos);
  }

  /**
   * `DELETE /api/v1/profesionales/:id`
   *
   * Elimina un profesional de la empresa activa si no tiene reservas asociadas.
   */
  @Delete(':id')
  @Roles('dueno', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un profesional' })
  @ApiResponse({ status: 204, description: 'Profesional eliminado' })
  @ApiErrores(401, 403, 404, 409)
  eliminar(@EmpresaId() empresaId: string, @Param('id') id: string): Promise<void> {
    return this.profesionalesService.eliminar(empresaId, id);
  }

  /**
   * `PUT /api/v1/profesionales/:id/servicios`
   *
   * Reemplaza de forma atómica la lista de servicios que atiende un profesional.
   */
  @Put(':id/servicios')
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Asignar servicios a un profesional' })
  @ApiZodBody(asignarServiciosProfesionalSchema)
  @ApiZodResponse(profesionalSchema, {
    status: 200,
    description: 'Servicios asignados al profesional',
  })
  @ApiErrores(400, 401, 403, 404)
  asignarServicios(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() datos: AsignarServiciosProfesionalDto,
  ): Promise<Profesional> {
    return this.profesionalesService.asignarServicios(empresaId, id, datos);
  }

  /**
   * `PUT /api/v1/profesionales/:id/usuario`
   *
   * Vincula o desvincula un profesional con una cuenta miembro de la empresa activa.
   */
  @Put(':id/usuario')
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Vincular o desvincular una cuenta miembro al profesional' })
  @ApiZodBody(vincularUsuarioProfesionalSchema)
  @ApiZodResponse(profesionalSchema, {
    status: 200,
    description: 'Vínculo de usuario actualizado',
  })
  @ApiErrores(400, 401, 403, 404, 409)
  vincularUsuario(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() datos: VincularUsuarioProfesionalDto,
  ): Promise<Profesional> {
    return this.profesionalesService.vincularUsuario(empresaId, id, datos);
  }
}
