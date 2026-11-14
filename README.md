# Agenda — Reservas en línea para negocios de servicios

Aplicación web multiempresa para que peluquerías, centros de salud y estética,
talleres y otros negocios de servicios publiquen su agenda, reciban reservas en
línea y administren su día a día desde un panel.

- **Plan y arquitectura:** [docs/PLAN.md](docs/PLAN.md)
- **Estado del avance:** [docs/ESTADO.md](docs/ESTADO.md)
- **Reglas para desarrollar (personas y agentes):** [AGENTS.md](AGENTS.md)

## Stack

| Capa          | Tecnología                                                               |
| ------------- | ------------------------------------------------------------------------ |
| Monorepo      | pnpm workspaces, Node.js 22, TypeScript estricto                         |
| Contratos     | Zod 4 (`packages/contracts`), compartidos por API y web                  |
| API           | NestJS 12 (ESM), Drizzle ORM, PostgreSQL 17, pino, OpenAPI               |
| Web           | Next.js 16 (App Router), React 19, Tailwind 4, shadcn/ui, TanStack Query |
| Segundo plano | Redis (colas de recordatorios), SMTP (Mailpit en desarrollo)             |
| Pruebas       | Vitest, Testcontainers (PostgreSQL real), Testing Library, Playwright    |
| Calidad       | ESLint, Prettier, commitlint, GitHub Actions                             |

## Estructura

```text
apps/
  api/                 API REST (/api/v1)
    drizzle/           Migraciones SQL
    src/
      common/          Errores, validación Zod, utilidades transversales
      config/          Variables de entorno validadas
      db/              Esquema, conexión, migraciones y seed
      health/          Chequeo de salud
      mail/            Puerto de correo y adaptador SMTP
    test/              Infraestructura de pruebas de integración
  web/                 Panel y página pública
    app/               Rutas: (marketing), (auth), (panel), (publico)
    components/        Componentes propios y de shadcn/ui (ui/)
    hooks/             Hooks de datos
    lib/               Cliente de API, formato, rutas
    e2e/               Pruebas de extremo a extremo
packages/
  contracts/           Esquemas Zod y tipos compartidos
docs/                  Plan, estado, modelo de datos, API, ADR y tareas
```

## Puesta en marcha

Requisitos: Node.js 22 o superior, pnpm 12 y Docker.

```bash
pnpm install
cp .env.example .env     # valores listos para desarrollo local
pnpm infra:up            # PostgreSQL, Redis y Mailpit
pnpm db:migrate          # crea las tablas
pnpm db:seed             # carga una empresa de demostración
pnpm dev                 # API en :4000 y web en :3000
```

| Qué                     | Dónde                          |
| ----------------------- | ------------------------------ |
| Web                     | http://localhost:3000          |
| Estado del sistema      | http://localhost:3000/estado   |
| API                     | http://localhost:4000/api/v1   |
| Documentación de la API | http://localhost:4000/api/docs |
| Correos capturados      | http://localhost:8025          |

## Comandos

| Comando            | Qué hace                                                     |
| ------------------ | ------------------------------------------------------------ |
| `pnpm dev`         | API y web con recarga en caliente                            |
| `pnpm verify`      | Formato, lint, tipos, pruebas unitarias y build              |
| `pnpm test`        | Pruebas unitarias                                            |
| `pnpm test:int`    | Pruebas de integración de la API (requiere Docker)           |
| `pnpm test:e2e`    | Pruebas E2E (requiere `pnpm build` y el navegador instalado) |
| `pnpm format`      | Aplica Prettier                                              |
| `pnpm db:generate` | Genera una migración desde los cambios del esquema           |
| `pnpm db:migrate`  | Aplica las migraciones pendientes                            |
| `pnpm db:seed`     | Datos de demostración (`-- --reset` para recrearlos)         |
| `pnpm infra:up`    | Levanta los servicios de apoyo en Docker                     |
| `pnpm infra:down`  | Los detiene                                                  |

Primera ejecución de las pruebas E2E:
`pnpm --filter @portfolio/web exec playwright install chromium`.

## Imágenes de producción

```bash
docker build -f apps/api/Dockerfile -t agenda-api .
docker build -f apps/web/Dockerfile --build-arg API_URL=http://api:4000 -t agenda-web .
```

La API aplica sus migraciones al arrancar. `API_URL` es la dirección interna
de la API vista desde el contenedor de la web y se fija al construir.

## Repositorio

El remoto es `reservas-pymes`. Para enlazarlo y subir por primera vez:

```bash
git remote add origin <URL de reservas-pymes>
git push -u origin main
```

Los hooks de git (Husky) aplican Prettier a los archivos del commit y validan
el mensaje con commitlint. `pnpm install` los activa.

## Desarrollo con agentes

El proyecto avanza por oleadas de tareas que ejecutan agentes de Antigravity.
El ciclo completo (preparar, ejecutar, revisar) y los mensajes para lanzar
cada agente están en [docs/tareas/README.md](docs/tareas/README.md).

## Documentación

| Documento                                    | Contenido                                      |
| -------------------------------------------- | ---------------------------------------------- |
| [docs/PLAN.md](docs/PLAN.md)                 | Producto, arquitectura, fases y tareas         |
| [docs/ESTADO.md](docs/ESTADO.md)             | Avance, decisiones vigentes y pendientes       |
| [docs/MODELO_DATOS.md](docs/MODELO_DATOS.md) | Diseño de la base de datos                     |
| [docs/API.md](docs/API.md)                   | Convenciones de la API                         |
| [docs/adr/](docs/adr/)                       | Decisiones de arquitectura                     |
| [docs/tareas/](docs/tareas/)                 | Tareas, BACKLOG y ciclo de trabajo con agentes |
| [docs/REVISION.md](docs/REVISION.md)         | Guía del revisor                               |
