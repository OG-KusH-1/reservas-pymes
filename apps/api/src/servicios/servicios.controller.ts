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
  actualizarServicioSchema,
  crearServicioSchema,
  paginaServiciosSchema,
  servicioSchema,
  type PaginaServicios,
  type Servicio,
} from '@portfolio/contracts';
import { COOKIE_SESION } from '../app.setup.js';
import { EmpresaId, Roles } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import { ActualizarServicioDto, ConsultaServiciosDto, CrearServicioDto } from './servicios.dto.js';
import { ServiciosService } from './servicios.service.js';

/**
 * Endpoints del catálogo de servicios de la empresa activa (`/api/v1/servicios`).
 *
 * Todos los roles autenticados pueden consultar el catálogo; solo `dueno` y
 * `admin` pueden crear, modificar o eliminar servicios.
 */
@ApiTags('Servicios')
@ApiCookieAuth(COOKIE_SESION)
@Controller('servicios')
export class ServiciosController {
  constructor(private readonly serviciosService: ServiciosService) {}

  /**
   * `GET /api/v1/servicios`
   *
   * Lista los servicios de la empresa activa con paginación por cursor y filtros
   * opcionales por estado, categoría y texto de búsqueda.
   */
  @Get()
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Listar los servicios de la empresa activa' })
  @ApiZodResponse(paginaServiciosSchema, {
    status: 200,
    description: 'Página de servicios del catálogo',
  })
  @ApiErrores(400, 401, 403)
  listar(
    @EmpresaId() empresaId: string,
    @Query() consulta: ConsultaServiciosDto,
  ): Promise<PaginaServicios> {
    return this.serviciosService.listar(empresaId, consulta);
  }

  /**
   * `GET /api/v1/servicios/:id`
   *
   * Obtiene el detalle de un servicio perteneciente a la empresa activa.
   */
  @Get(':id')
  @Roles('dueno', 'admin', 'recepcion', 'profesional')
  @ApiOperation({ summary: 'Obtener un servicio por su identificador' })
  @ApiZodResponse(servicioSchema, { status: 200, description: 'Servicio encontrado' })
  @ApiErrores(401, 403, 404)
  obtener(@EmpresaId() empresaId: string, @Param('id') id: string): Promise<Servicio> {
    return this.serviciosService.obtener(empresaId, id);
  }

  /**
   * `POST /api/v1/servicios`
   *
   * Crea un nuevo servicio en el catálogo de la empresa activa.
   */
  @Post()
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Crear un servicio en la empresa activa' })
  @ApiZodBody(crearServicioSchema)
  @ApiZodResponse(servicioSchema, { status: 201, description: 'Servicio creado' })
  @ApiErrores(400, 401, 403, 409)
  crear(@EmpresaId() empresaId: string, @Body() datos: CrearServicioDto): Promise<Servicio> {
    return this.serviciosService.crear(empresaId, datos);
  }

  /**
   * `PATCH /api/v1/servicios/:id`
   *
   * Actualiza parcialmente un servicio de la empresa activa.
   */
  @Patch(':id')
  @Roles('dueno', 'admin')
  @ApiOperation({ summary: 'Actualizar un servicio de la empresa activa' })
  @ApiZodBody(actualizarServicioSchema)
  @ApiZodResponse(servicioSchema, { status: 200, description: 'Servicio actualizado' })
  @ApiErrores(400, 401, 403, 404, 409)
  actualizar(
    @EmpresaId() empresaId: string,
    @Param('id') id: string,
    @Body() datos: ActualizarServicioDto,
  ): Promise<Servicio> {
    return this.serviciosService.actualizar(empresaId, id, datos);
  }

  /**
   * `DELETE /api/v1/servicios/:id`
   *
   * Elimina un servicio del catálogo si no tiene reservas asociadas.
   */
  @Delete(':id')
  @Roles('dueno', 'admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un servicio de la empresa activa' })
  @ApiResponse({ status: 204, description: 'Servicio eliminado' })
  @ApiErrores(401, 403, 404, 409)
  eliminar(@EmpresaId() empresaId: string, @Param('id') id: string): Promise<void> {
    return this.serviciosService.eliminar(empresaId, id);
  }
}
