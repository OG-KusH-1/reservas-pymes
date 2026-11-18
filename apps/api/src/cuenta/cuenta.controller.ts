import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, hours, minutes } from '@nestjs/throttler';
import {
  cambiarContrasenaSchema,
  restablecerContrasenaSchema,
  solicitarRecuperacionSchema,
  verificarCorreoSchema,
} from '@portfolio/contracts';
import { COOKIE_SESION } from '../app.setup.js';
import { Publico, SesionActual, type ContextoSesion } from '../auth/auth.decorators.js';
import { ApiErrores, ApiZodBody } from '../common/zod/api-zod.decorators.js';
import {
  CambiarContrasenaDto,
  RestablecerContrasenaDto,
  SolicitarRecuperacionDto,
  VerificarCorreoDto,
} from './cuenta.dto.js';
import { CuentaService } from './cuenta.service.js';

/**
 * Endpoints de seguridad de cuenta bajo `/api/v1/auth/...` y `/api/v1/publico/...`:
 * verificación de correo electrónico, recuperación/restablecimiento de
 * contraseña olvidada y cambio de contraseña desde una sesión activa.
 */
@ApiTags('Cuenta')
@Controller()
export class CuentaController {
  constructor(private readonly cuentaService: CuentaService) {}

  /**
   * `POST /api/v1/auth/verificar-correo/enviar`
   *
   * Reenvía el correo de verificación al usuario autenticado. Si su correo ya
   * figura como verificado, responde `204` de forma idempotente sin enviar correo.
   */
  @Post('auth/verificar-correo/enviar')
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(COOKIE_SESION)
  @ApiOperation({ summary: 'Enviar correo de verificación de cuenta' })
  @ApiResponse({ status: 204, description: 'Correo enviado o cuenta ya verificada' })
  @ApiErrores(401, 429)
  async enviarVerificacion(@SesionActual() sesion: ContextoSesion): Promise<void> {
    await this.cuentaService.enviarVerificacionCorreo(sesion.usuario.id);
  }

  /**
   * `POST /api/v1/publico/verificar-correo`
   *
   * Confirma el correo electrónico consumiendo un token de un solo uso.
   */
  @Post('publico/verificar-correo')
  @Publico()
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirmar correo electrónico mediante token' })
  @ApiZodBody(verificarCorreoSchema)
  @ApiResponse({ status: 204, description: 'Correo verificado' })
  @ApiErrores(400, 409, 429)
  async verificarCorreo(@Body() datos: VerificarCorreoDto): Promise<void> {
    await this.cuentaService.verificarCorreo(datos.token);
  }

  /**
   * `POST /api/v1/publico/recuperar`
   *
   * Solicita un enlace de recuperación de contraseña. Responde siempre `204`
   * exista o no el correo para evitar enumeración de cuentas.
   */
  @Post('publico/recuperar')
  @Publico()
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Solicitar recuperación de contraseña' })
  @ApiZodBody(solicitarRecuperacionSchema)
  @ApiResponse({ status: 204, description: 'Solicitud procesada' })
  @ApiErrores(400, 429)
  async solicitarRecuperacion(@Body() datos: SolicitarRecuperacionDto): Promise<void> {
    await this.cuentaService.solicitarRecuperacion(datos.email);
  }

  /**
   * `POST /api/v1/publico/restablecer`
   *
   * Restablece la contraseña mediante el token de recuperación, invalida tokens
   * pendientes y revoca todas las sesiones activas del usuario.
   */
  @Post('publico/restablecer')
  @Publico()
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restablecer contraseña mediante token' })
  @ApiZodBody(restablecerContrasenaSchema)
  @ApiResponse({ status: 204, description: 'Contraseña restablecida' })
  @ApiErrores(400, 409, 429)
  async restablecerContrasena(@Body() datos: RestablecerContrasenaDto): Promise<void> {
    await this.cuentaService.restablecerContrasena(datos.token, datos.password);
  }

  /**
   * `POST /api/v1/auth/cambiar-contrasena`
   *
   * Actualiza la contraseña de la sesión activa verificando la contraseña
   * actual, y revoca todas las demás sesiones del usuario.
   */
  @Post('auth/cambiar-contrasena')
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(COOKIE_SESION)
  @ApiOperation({ summary: 'Cambiar contraseña de la cuenta autenticada' })
  @ApiZodBody(cambiarContrasenaSchema)
  @ApiResponse({ status: 204, description: 'Contraseña actualizada' })
  @ApiErrores(400, 401, 429)
  async cambiarContrasena(
    @SesionActual() sesion: ContextoSesion,
    @Body() datos: CambiarContrasenaDto,
  ): Promise<void> {
    await this.cuentaService.cambiarContrasena(
      sesion.usuario.id,
      sesion.sesionId,
      datos.passwordActual,
      datos.passwordNueva,
    );
  }
}
