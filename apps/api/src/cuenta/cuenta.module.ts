import { Module } from '@nestjs/common';

/**
 * Módulo de verificación de correo, recuperación y cambio de contraseña.
 * Se registra desde la base común en `AppModule` para evitar colisiones entre
 * tareas paralelas; T13 implementa aquí sus controladores y servicios.
 */
@Module({})
export class CuentaModule {}
