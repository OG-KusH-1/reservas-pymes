# syntax=docker/dockerfile:1
#
# Imagen de producción de la API.
#
# Se construye desde la RAÍZ del monorepo, porque necesita el lockfile y el
# paquete de contratos:
#
#   docker build -f apps/api/Dockerfile -t agenda-api .
#
# Etapas:
#   base     Node + pnpm (vía corepack, con la versión fijada en package.json).
#   build    instala todo, compila contratos y API, y extrae con `pnpm deploy`
#            una carpeta autocontenida solo con dependencias de producción.
#   runtime  imagen final mínima: solo el código compilado, las migraciones y
#            las dependencias de producción (lo define el campo `files` de
#            apps/api/package.json), con un usuario sin privilegios.

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Primero solo los manifiestos: mientras no cambien las dependencias, Docker
# reutiliza la capa de instalación aunque cambie el código.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @portfolio/api...

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @portfolio/contracts build \
 && pnpm --filter @portfolio/api build \
 && pnpm --filter @portfolio/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# `pnpm deploy` copia package.json, dist/, drizzle/ (migraciones) y node_modules.
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000

# Usa el chequeo de salud de la propia API. `wget` viene incluido en Alpine.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/v1/health" || exit 1

# Aplica las migraciones pendientes y luego arranca. Es idempotente; con varias
# réplicas conviene mover la migración a un paso previo del despliegue.
# `exec` reemplaza al shell por Node, que así recibe SIGTERM directamente y
# puede cerrar de forma ordenada (conexiones a la base de datos, correo).
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/main.js"]
