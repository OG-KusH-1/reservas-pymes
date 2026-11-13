import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import type { NextConfig } from 'next';

// Next solo lee los `.env` de su propia carpeta. El proyecto tiene un único
// `.env` en la raíz del monorepo, compartido con la API, así que se carga aquí.
const raizMonorepo = path.join(import.meta.dirname, '../..');
loadEnvConfig(raizMonorepo, process.env.NODE_ENV !== 'production');

/** Dirección interna de la API, sin barra final. */
const URL_API = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Imagen de contenedor mínima: solo se activa en el build de Docker
  // (`NEXT_OUTPUT=standalone` en el Dockerfile). En Windows el modo standalone
  // requiere permisos para crear enlaces simbólicos, por eso no es el modo
  // por defecto del build local.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // Necesario en un monorepo para que el rastreo de archivos incluya los
  // paquetes del workspace (`@portfolio/contracts`).
  outputFileTracingRoot: raizMonorepo,

  /**
   * Reenvía `/api/*` a la API. Para el navegador, la web y la API comparten
   * origen: la cookie de sesión es de primera parte (`SameSite=Lax`) y no hay
   * CORS ni peticiones de verificación previa.
   *
   * Importante: los rewrites se resuelven al COMPILAR. `API_URL` debe estar
   * definida al ejecutar `next build` (en Docker, como argumento de build).
   */
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${URL_API}/api/:path*` }];
  },

  /**
   * Cabeceras de seguridad para todas las respuestas de la web.
   * La política de contenido (CSP) queda para la Fase 7: requiere `nonce` por
   * petición y debe probarse contra todas las pantallas ya construidas.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
