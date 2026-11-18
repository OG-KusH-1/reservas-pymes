import { Module } from '@nestjs/common';

/**
 * Módulo de gestión de miembros, invitaciones y cambio de empresa activa.
 * Se registra desde la base común en `AppModule` para evitar colisiones entre
 * tareas paralelas; T12 implementa aquí sus controladores y servicios.
 */
@Module({})
export class MiembrosModule {}
