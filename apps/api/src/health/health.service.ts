import { Injectable } from '@nestjs/common';
import { queryClient } from '../db/index.js';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  services: {
    api: 'healthy';
    database: 'connected' | 'disconnected';
  };
  version: string;
}

@Injectable()
export class HealthService {
  /**
   * Ejecuta el chequeo de salud del servicio y de la base de datos.
   * 
   * ¿Por qué este chequeo?
   * Permite a los orquestadores (Docker, Kubernetes) y al frontend verificar
   * el estado operativo sin lanzar excepciones no controladas si la base de datos
   * se encuentra en proceso de inicio o migración.
   */
  async check(): Promise<HealthCheckResponse> {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';

    try {
      // Chequeo ligero no bloqueante a PostgreSQL
      await queryClient`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        api: 'healthy',
        database: dbStatus,
      },
      version: '0.1.0',
    };
  }
}
