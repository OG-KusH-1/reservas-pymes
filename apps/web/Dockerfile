# syntax=docker/dockerfile:1
#
# Imagen de producción de la web (Next.js en modo standalone).
#
# Se construye desde la RAÍZ del monorepo:
#
#   docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:4000 -t agenda-web .
#
# API_URL es la dirección INTERNA de la API tal como la ve este contenedor.
# Debe pasarse al construir: los rewrites de Next (`/api/*` → API) se resuelven
# durante `next build` y quedan fijos en la imagen.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @portfolio/web...

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

ARG API_URL=http://api:4000
ENV API_URL=$API_URL
# Activa `output: 'standalone'` (ver next.config.ts): Next copia solo los
# archivos que la aplicación realmente usa, incluidos los del workspace.
ENV NEXT_OUTPUT=standalone
RUN pnpm --filter @portfolio/contracts build \
 && pnpm --filter @portfolio/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# El modo standalone conserva la estructura del monorepo: el servidor queda en
# apps/web/server.js. Los archivos estáticos no se incluyen y se copian aparte.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# Al crear la carpeta `apps/web/public` (favicon, imágenes), copiarla también:
# COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:3000/" > /dev/null || exit 1

CMD ["node", "apps/web/server.js"]
