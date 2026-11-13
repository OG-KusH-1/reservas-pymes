import { fileURLToPath } from 'node:url';
import type { ConfigService } from '@nestjs/config';
import { z } from 'zod';

/**
 * Esquema de las variables de entorno de la API.
 *
 * Es la única puerta de entrada de la configuración: ningún otro archivo debe
 * leer `process.env` directamente. Si falta una variable obligatoria o tiene
 * un valor inválido, la API se niega a arrancar y muestra qué corregir; es
 * preferible fallar al inicio que con la primera petición de un cliente.
 *
 * Para agregar una variable:
 *  1. Declárala aquí con su validación y, si corresponde, un valor por defecto
 *     seguro para desarrollo. Nunca pongas un secreto como valor por defecto.
 *  2. Documéntala en `.env.example` (raíz del monorepo).
 *  3. Léela con `ConfigService` tipado: `config.get('NOMBRE', { infer: true })`.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Cadena de conexión de PostgreSQL. Obligatoria: no tiene valor por defecto a propósito. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Conexiones máximas del pool de este proceso. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  /**
   * URL pública de la web. Se usa como origen permitido de CORS y como base
   * de los enlaces que viajan en los correos.
   */
  WEB_URL: z
    .url()
    .default('http://localhost:3000')
    // Se reduce al origen (`esquema://host:puerto`), sin barra final ni ruta:
    // es lo que envía el navegador en la cabecera `Origin`, y con lo que se
    // compara en CORS y en la verificación de origen.
    .transform((valor) => new URL(valor).origin),

  /**
   * Cantidad de proxies de confianza delante de la API (ver `app.setup.ts`).
   * 1 = solo la web (rewrites de Next) o solo un balanceador. Súmale uno por
   * cada salto adicional (balanceador + web = 2). Con 0 no se confía en
   * `X-Forwarded-For`. Un valor mayor al real permitiría a un cliente
   * falsificar su IP y evadir el límite de peticiones.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),

  /** Redis: colas de trabajos en segundo plano (recordatorios). */
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://localhost:6379'),

  /** Días de vigencia de una sesión del panel sin actividad. */
  SESSION_TTL_DIAS: z.coerce.number().int().min(1).max(365).default(30),

  /** Límite global de peticiones por IP: `THROTTLE_LIMITE` cada `THROTTLE_TTL_SEGUNDOS`. */
  THROTTLE_TTL_SEGUNDOS: z.coerce.number().int().min(1).default(60),
  THROTTLE_LIMITE: z.coerce.number().int().min(1).default(120),

  /** Servidor SMTP. En desarrollo apunta a Mailpit (docker compose). */
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  /** `true` para TLS implícito (puerto 465). Con STARTTLS (587) debe ser `false`. */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
  MAIL_FROM: z.string().min(1).default('Agenda <no-responder@agenda.local>'),

  /** Contraseña del usuario de demostración que crea `pnpm db:seed`. Solo desarrollo. */
  SEED_PASSWORD: z.string().min(10).default('demo-agenda-2026'),
});

export type Env = z.infer<typeof envSchema>;

/** `ConfigService` con las claves y tipos de {@link envSchema}. Úsalo en los constructores. */
export type AppConfig = ConfigService<Env, true>;

/**
 * Archivos `.env` que se cargan, en orden de prioridad. Las rutas se calculan
 * desde este archivo y no desde el directorio de trabajo, para que funcione
 * igual con `pnpm dev`, con los scripts de base de datos y con las pruebas.
 * La profundidad es la misma en `src/config` y en `dist/config`.
 */
export const RUTAS_ENV = [
  fileURLToPath(new URL('../../.env', import.meta.url)), // apps/api/.env (opcional, tiene prioridad)
  fileURLToPath(new URL('../../../../.env', import.meta.url)), // raíz del monorepo
];

/**
 * Valida el entorno y devuelve la configuración tipada.
 * La usa `ConfigModule` al arrancar y los scripts que corren fuera de Nest.
 *
 * @throws Error con la lista de variables inválidas, una por línea.
 */
export function validarEntorno(crudo: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(crudo);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuración de entorno inválida:\n${problemas}\n` +
        'Revisa el archivo .env (usa .env.example como referencia).',
    );
  }
  return resultado.data;
}
