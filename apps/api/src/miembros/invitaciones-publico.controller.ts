import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import {
  aceptarInvitacionSchema,
  detalleInvitacionPublicaSchema,
  sesionSchema,
  type DetalleInvitacionPublica,
  type Sesion,
} from '@portfolio/contracts';
import type { Request, Response } from 'express';
import { COOKIE_SESION } from '../app.setup.js';
import { Publico } from '../auth/auth.decorators.js';
import { establecerCookieSesion } from '../auth/session.cookie.js';
import { ApiErrores, ApiZodBody, ApiZodResponse } from '../common/zod/api-zod.decorators.js';
import type { Env } from '../config/env.js';
import { InvitacionesService } from './invitaciones.service.js';
import { AceptarInvitacionDto } from './miembros.dto.js';

/**
 * Endpoints públicos de consulta y aceptación de invitaciones
 * (`/api/v1/publico/invitaciones`).
 *
 * Protegidos con límite estricto de peticiones (`@Throttle`) para dificultar
 * la enumeración o fuerza bruta sobre tokens.
 */
@ApiTags('Invitaciones públicas')
@Publico()
@Throttle({ default: { limit: 10, ttl: minutes(15) } })
@Controller('publico/invitaciones')
export class InvitacionesPublicoController {
  constructor(
    private readonly invitacionesService: InvitacionesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * `GET /api/v1/publico/invitaciones/:token`
   *
   * Devuelve los datos mínimos de la invitación para que la web decida si
   * pedir creación de cuenta o inicio de sesión.
   */
  @Get(':token')
  @ApiOperation({ summary: 'Consultar detalle público de una invitación por token' })
  @ApiZodResponse(detalleInvitacionPublicaSchema, {
    status: 200,
    description: 'Invitación válida',
  })
  @ApiErrores(404, 409, 429)
  obtenerDetalle(@Param('token') token: string): Promise<DetalleInvitacionPublica> {
    return this.invitacionesService.obtenerDetallePublico(token);
  }

  /**
   * `POST /api/v1/publico/invitaciones/:token/aceptar`
   *
   * Acepta la invitación (creando el usuario si es nuevo o validando la sesión
   * si ya existe), crea la membresía y emite la cookie de sesión en la empresa
   * invitante.
   */
  @Post(':token/aceptar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar una invitación pública' })
  @ApiZodBody(aceptarInvitacionSchema)
  @ApiZodResponse(sesionSchema, {
    status: 200,
    description: 'Invitación aceptada y sesión iniciada',
  })
  @ApiErrores(400, 401, 403, 404, 409, 429)
  async aceptar(
    @Param('token') token: string,
    @Body() datos: AceptarInvitacionDto,
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<Sesion> {
    const tokenCookie: unknown = (peticion.cookies as Record<string, unknown> | undefined)?.[
      COOKIE_SESION
    ];
    const { sesion, token: nuevoToken } = await this.invitacionesService.aceptarPublico(
      token,
      datos,
      typeof tokenCookie === 'string' ? tokenCookie : undefined,
      {
        ip: peticion.ip,
        userAgent: peticion.get('user-agent'),
      },
    );

    establecerCookieSesion(respuesta, nuevoToken, {
      ttlDias: this.config.get('SESSION_TTL_DIAS', { infer: true }),
      esProduccion: this.config.get('NODE_ENV', { infer: true }) === 'production',
    });

    return sesion;
  }
}
