# Plataforma de Reservas y Recordatorios (Cimientos Monorepo)

Sistema integral de gestión de reservas, agendas y recordatorios diseñado específicamente para pequeños negocios de servicios (peluquerías, centros de kinesiología, talleres mecánicos, estética, entre otros).

El proyecto está concebido con una arquitectura **multiempresa (multi-tenant) nativa desde el primer día**, asegurando aislamiento total de datos mediante la inclusión obligatoria de `empresa_id` en todas las entidades relacionales.

---

## 🛠️ Stack Tecnológico

El stack replica y consolida los aprendizajes del proyecto de referencia **Tangata**:

- **Gestor de Monorepo:** [pnpm](https://pnpm.io/) (Workspaces) con Node.js 22 LTS.
- **Backend (`apps/api`):**
  - [NestJS 12](https://nestjs.com/) configurado en modo nativo ECMAScript Modules (ESM).
  - [Drizzle ORM](https://orm.drizzle.team/) para acceso a base de datos de alto rendimiento y type-safety estricto.
  - [PostgreSQL 17](https://www.postgresql.org/) como motor relacional de almacenamiento.
  - [Vitest](https://vitest.dev/) con SWC para ejecución ultrarrápida de pruebas automatizadas.
  - [Zod](https://zod.dev/) para validación rigurosa de entradas y contratos en tiempo de ejecución.
- **Frontend (`apps/web`):**
  - [Next.js 16](https://nextjs.org/) con App Router y compilación Turbopack.
  - [React 19](https://react.dev/).
  - [Tailwind CSS 4](https://tailwindcss.com/) para diseño reactivo de alta fidelidad.
- **Infraestructura Local:** Docker Compose con PostgreSQL 17 Alpine.
- **Integración Continua (CI):** GitHub Actions configurado para validar linting, pruebas y compilación en cada Pull Request.

---

## 📁 Estructura del Monorepo

```text
├── .github/
│   └── workflows/
│       └── ci.yml               # Pipeline de integración continua
├── apps/
│   ├── api/                     # Backend NestJS 12 ESM
│   │   ├── drizzle/             # Migraciones SQL generadas por Drizzle Kit
│   │   ├── src/
│   │   │   ├── common/pipes/    # ZodValidationPipe para validación declarativa
│   │   │   ├── db/              # Conexión Drizzle, esquema multiempresa y seed
│   │   │   ├── health/          # Endpoint GET /api/health y pruebas Vitest
│   │   │   ├── app.module.ts    # Módulo raíz de NestJS
│   │   │   └── main.ts          # Bootstrap de la aplicación con CORS y prefijo /api
│   │   ├── drizzle.config.ts    # Configuración de Drizzle Kit
│   │   ├── tsconfig.json        # Configuración TypeScript NodeNext ESM
│   │   └── vitest.config.ts     # Configuración de Vitest con plugin SWC
│   └── web/                     # Frontend Next.js 16
│       ├── app/
│       │   ├── globals.css      # Estilos globales con Tailwind CSS 4 (@import "tailwindcss")
│       │   ├── layout.tsx       # Layout principal
│       │   ├── page.tsx         # Dashboard de monitoreo que consume /api/health
│       │   └── page.spec.ts     # Pruebas de configuración en Vitest
│       └── next.config.ts       # Configuración de Next.js
├── docs/
│   └── adr/
│       └── 0001-stack.md        # Registro de Decisión Arquitectónica del stack
├── .env.example                 # Plantilla de variables de entorno sin secretos
├── .gitignore                   # Exclusión estricta de credenciales, dist y dependencias
├── AGENTS.md                    # Normas para agentes y desarrolladores
├── docker-compose.yml           # Servicio local de PostgreSQL 17 Alpine
├── package.json                 # Scripts raíz del monorepo
├── pnpm-workspace.yaml          # Definición de paquetes del workspace pnpm
└── README.md                    # Documentación principal del proyecto
```

---

## 🚀 Cómo Levantarlo Paso a Paso

### 1. Prerrequisitos

- **Node.js:** Versión `>= 22.0.0`
- **pnpm:** Versión `>= 10.0.0` (o `12.x`)
- **Docker & Docker Compose:** Activo y corriendo en el sistema

### 2. Configuración de Variables de Entorno

Copia el archivo de ejemplo a tu archivo `.env` local:

```bash
cp .env.example .env
```

> **Nota de Seguridad:** Nunca agregues secretos reales ni subas el archivo `.env` al control de versiones.

### 3. Levantar la Base de Datos

Inicia el contenedor de PostgreSQL 17 en segundo plano:

```bash
docker compose up -d
```

Puedes verificar el estado del contenedor con:

```bash
docker compose ps
```

### 4. Instalar Dependencias

Desde la raíz del repositorio, ejecuta:

```bash
pnpm install
```

### 5. Generar y Aplicar Migraciones

Genera los archivos SQL del esquema y sincroniza la base de datos:

```bash
# Generar migraciones basadas en src/db/schema.ts
pnpm db:generate

# Aplicar las migraciones a la base de datos en PostgreSQL
pnpm db:migrate
```

### 6. Poblar Datos de Prueba (Seed Opcional)

Para cargar un negocio demo ("Barbería & Spa El Portal"), servicios, profesionales, horarios y citas:

```bash
pnpm db:seed
```

### 7. Ejecutar en Modo Desarrollo

Levanta tanto la API como la interfaz web en paralelo:

```bash
pnpm dev
```

O levanta cada aplicación por separado según lo requieras:

- **API únicamente:** `pnpm dev:api` (disponible en `http://localhost:4000/api/health`)
- **Web únicamente:** `pnpm dev:web` (disponible en `http://localhost:3000`)

---

## 📜 Scripts Disponibles en la Raíz

| Comando | Descripción |
| :--- | :--- |
| `pnpm dev` | Inicia simultáneamente `apps/api` y `apps/web` en modo desarrollo |
| `pnpm dev:api` | Inicia solo el backend NestJS con recarga en caliente vía `tsx` |
| `pnpm dev:web` | Inicia solo el frontend Next.js 16 con Turbopack |
| `pnpm test` | Ejecuta las suites de prueba en todas las aplicaciones con Vitest |
| `pnpm lint` | Ejecuta el linter (ESLint) en todas las aplicaciones |
| `pnpm build` | Compila tanto la API como la aplicación Web para producción |
| `pnpm db:generate` | Genera las migraciones SQL a partir de los esquemas Drizzle |
| `pnpm db:migrate` | Sincroniza y aplica el esquema sobre la base de datos PostgreSQL |
| `pnpm db:seed` | Inserta datos de prueba multiempresa iniciales |

---

## 🗄️ Esquema Relacional Base (Multiempresa)

El sistema define 5 tablas nucleares con clave foránea `empresa_id` para garantizar segregación estricta de datos:

1. **`empresas`**: Registro raíz del comercio o prestador (nombre, slug único para URLs, RUT, teléfono, email).
2. **`servicios`**: Prestaciones ofrecidas (duración en minutos, precio, estado activo, pertenencia por `empresa_id`).
3. **`profesionales`**: Especialistas o prestadores de servicio vinculados a la empresa (`empresa_id`).
4. **`horarios`**: Franjas horarias de disponibilidad semanal recurrente por profesional (`empresa_id`, `profesional_id`, `dia_semana`, `hora_inicio`, `hora_fin`).
5. **`reservas`**: Citas agendadas por clientes (`empresa_id`, `servicio_id`, `profesional_id`, fechas con zona horaria, datos del cliente y estado del ciclo de vida).

---

## 📌 Enfoque de Fases y Roadmap

Siguiendo el principio aplicado en **Tangata**, este hito establece exclusivamente los cimientos arquitectónicos, infraestructura y modelo de datos.

- **Fase Actual (Cimientos):** Estructura monorepo, Docker, base de datos relacional multiempresa, salud del sistema y pipeline de CI.
- **Fases Siguientes:**
  - Lógica de negocio de disponibilidad de turnos.
  - Autenticación y roles de usuario.
  - Integración de notificaciones y recordatorios por **WhatsApp** (al final del ciclo).
  - Pasarela de **Pagos en línea** (al final del ciclo).
