import { z } from 'zod';

/** Respuesta de `GET /api/v1/health`. */
export const saludSchema = z.object({
  /** `degraded` cuando la API responde pero alguna dependencia no. */
  status: z.enum(['ok', 'degraded']),
  timestamp: z.iso.datetime(),
  /** Segundos desde que arrancó el proceso. */
  uptime: z.number(),
  environment: z.string(),
  services: z.object({
    api: z.literal('healthy'),
    database: z.enum(['connected', 'disconnected']),
  }),
  version: z.string(),
});
export type Salud = z.infer<typeof saludSchema>;
