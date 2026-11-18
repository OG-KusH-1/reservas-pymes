import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, hours, minutes } from '@nestjs/throttler';
import {
  iniciarSesionSchema,
  registroSchema,
  sesionSchema,
  type Sesion,
} from '@portfolio/contracts';
import type { Request, Response } from 'express';
import { COOKIE_SESION } from '../app.setup.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import type { Env } from '../config/env.js';
import { Publico, SesionActual, type ContextoSesion } from './auth.decorators.js';
import { IniciarSesionDto, RegistroDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { establecerCookieSesion, limpiarCookieSesion } from './session.cookie.js';

/**
 * Endpoints de autenticación bajo `/api/v1/auth`.
 *
 * Maneja registro de empresa + dueño, inicio de sesión, cierre de sesión y
 * lectura de la sesión actual usando cookie `httpOnly` (`COOKIE_SESION`).
 */
@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * `POST /api/v1/auth/registro`
   *
   * Crea una empresa y su cuenta de dueño en una transacción, emite la cookie
   * de sesión y devuelve el contexto inicial de la sesión.
   */
  @Post('registro')
  @Publico()
  @Throttle({ default: { limit: 5, ttl: hours(1) } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar una empresa y su cuenta de dueño' })
  @ApiZodBody(registroSchema)
  @ApiZodResponse(sesionSchema, { status: 201, description: 'Empresa y cuenta creadas' })
  @ApiErrores(400, 409, 429)
  async registrar(
    @Body() datos: RegistroDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<Sesion> {
    const { sesion, token } = await this.authService.registrar(datos, {
      ip: peticion.ip,
      userAgent: peticion.get('user-agent'),
    });

    establecerCookieSesion(respuesta, token, this.opcionesCookie());
    return sesion;
  }

  /**
   * `POST /api/v1/auth/ingresar`
   *
   * Verifica las credenciales, abre sesión en la empresa más antigua del
   * usuario y escribe la cookie de sesión `httpOnly`.
   */
  @Post('ingresar')
  @Publico()
  @Throttle({ default: { limit: 10, ttl: minutes(15) } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiZodBody(iniciarSesionSchema)
  @ApiZodResponse(sesionSchema, { status: 200, description: 'Sesión iniciada' })
  @ApiErrores(400, 401, 429)
  async ingresar(
    @Body() datos: IniciarSesionDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<Sesion> {
    const { sesion, token } = await this.authService.ingresar(datos, {
      ip: peticion.ip,
      userAgent: peticion.get('user-agent'),
    });

    establecerCookieSesion(respuesta, token, this.opcionesCookie());
    return sesion;
  }

  /**
   * `POST /api/v1/auth/salir`
   *
   * Revoca la sesión actual (si existe) y limpia la cookie. Es idempotente:
   * responde `204` incluso sin cookie o con una cookie ya expirada.
   */
  @Post('salir')
  @Publico()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cerrar la sesión actual' })
  @ApiResponse({ status: 204, description: 'Sesión cerrada' })
  async salir(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<void> {
    const token: unknown = (peticion.cookies as Record<string, unknown> | undefined)?.[
      COOKIE_SESION
    ];
    await this.authService.salir(typeof token === 'string' ? token : undefined);
    limpiarCookieSesion(respuesta, { esProduccion: this.esProduccion() });
  }

  /**
   * `GET /api/v1/auth/sesion`
   *
   * Devuelve el usuario, empresa activa y rol de la sesión vigente.
   */
  @Get('sesion')
  @ApiCookieAuth(COOKIE_SESION)
  @ApiOperation({ summary: 'Obtener la sesión actual' })
  @ApiZodResponse(sesionSchema, { status: 200, description: 'Sesión vigente' })
  @ApiErrores(401)
  obtenerSesion(@SesionActual() contexto: ContextoSesion): Sesion {
    return {
      usuario: contexto.usuario,
      empresa: contexto.empresa,
      rol: contexto.rol,
    };
  }

  private esProduccion(): boolean {
    return this.config.get('NODE_ENV', { infer: true }) === 'production';
  }

  private opcionesCookie() {
    return {
      ttlDias: this.config.get('SESSION_TTL_DIAS', { infer: true }),
      esProduccion: this.esProduccion(),
    };
  }
}
