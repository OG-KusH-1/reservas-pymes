# ADR 0001: Selección del Stack Tecnológico y Arquitectura de Cimientos

- **Estado:** Aceptado
- **Fecha:** 2026-11-12
- **Ámbito:** Arquitectura Monorepo, Backend, Base de Datos y Frontend
- **Autores:** Equipo de Arquitectura de Software

---

## 1. Contexto y Problema

Se requiere construir la base técnica de un sistema de reservas y recordatorios enfocado en pequeños negocios de servicios (peluquerías, centros kinésicos, talleres mecánicos, salones de estética).

Los requisitos fundamentales del proyecto son:

1. **Multiempresa (Multi-tenant) desde el inicio:** Cada negocio debe operar con sus propios servicios, profesionales, horarios y reservas sin riesgo de contaminación cruzada de datos.
2. **Reutilización del conocimiento del proyecto Tangata:** Aprovechar las decisiones probadas en Tangata para maximizar la velocidad de entrega, evitar problemas conocidos y mantener coherencia arquitectónica.
3. **Cimientos limpios:** Establecer únicamente la infraestructura, modelos y endpoints de monitoreo base, postergando la lógica de negocio y las integraciones externas complejas (WhatsApp y pasarelas de pago) para fases posteriores.

---

## 2. Decisión de Arquitectura

Se ha seleccionado un monorepo administrado con **pnpm Workspaces**, organizado de la siguiente manera:

```text
├── apps/
│   ├── api (NestJS 12 ESM + Drizzle ORM + PostgreSQL 17 + Vitest + Zod)
│   └── web (Next.js 16 + React 19 + Tailwind CSS 4)
├── docker-compose.yml (PostgreSQL 17 Alpine)
└── .github/workflows/ci.yml (Integración continua en PRs)
```

---

## 3. Justificación Técnica y Comparativa

### 3.1 Backend: NestJS 12 en modo ECMAScript Modules (ESM)

- **Por qué NestJS:** Proporciona un marco de trabajo corporativo con inyección de dependencias, desacoplamiento por módulos y una convención clara de controladores, servicios y pipes.
- **Por qué ESM (`"type": "module"`):** Es el estándar moderno de JavaScript en Node.js 22+. Elimina los problemas de importación dinámica de paquetes modernos y alinea todo el monorepo en una especificación común.

### 3.2 ORM: Drizzle ORM vs. Prisma / TypeORM

- **Comparativa con Prisma:** Prisma requiere un binario en Rust (`query engine`) que incrementa los tiempos de compilación, penaliza los cold starts en entornos serverless o contenedores y utiliza una capa de abstracción compleja para migraciones.
- **Comparativa con TypeORM:** TypeORM presenta problemas frecuentes en ESM debido a su alta dependencia de `reflect-metadata` legado y decoradores experimentales no estandarizados.
- **Por qué Drizzle ORM:**
  - Filosofía _"Si sabes SQL, sabes Drizzle"_: genera código SQL predecible sin consultas N+1 ocultas.
  - Cero sobrecarga de runtime: no incluye binarios externos ni engines pesados.
  - Inferencia de tipos de TypeScript perfecta a partir del esquema declarativo.
  - Migraciones ligeras y transparentes mediante `drizzle-kit`.

### 3.3 Motor de Base de Datos: PostgreSQL 17

- PostgreSQL 17 aporta mejoras significativas en rendimiento para consultas con transacciones concurrentes, optimización en el uso de memoria en `COPY` y mejoras en planes de ejecución para particionamiento.
- Apto para habilitar **Row-Level Security (RLS)** a futuro basándose en la columna `empresa_id`.

### 3.4 Validación: Zod vs. class-validator

- `class-validator` y `class-transformer` añaden sobrecarga y requieren mantener clases redundantes con decoradores experimentales.
- **Zod** permite componer esquemas funcionales, generar tipos TypeScript automáticamente (`z.infer<typeof schema>`) y validar datos de forma estricta en el `ZodValidationPipe`.

### 3.5 Suite de Pruebas: Vitest vs. Jest

- Jest presenta fricción severa para soportar ESM de forma nativa en monorepos y resulta lento al transpilar TypeScript mediante `ts-jest` o `babel`.
- **Vitest** aprovecha el compilador SWC para resolver los metadatos de decoradores de NestJS y corre en hilos paralelos de alto rendimiento, reduciendo el tiempo de prueba de segundos a milisegundos.

### 3.6 Frontend: Next.js 16 + React 19 + Tailwind CSS 4

- **Next.js 16 (App Router con Turbopack):** Permite renderizado del lado del servidor (SSR) para páginas públicas de reservas amigables con SEO, streaming y compilación ultrarrápida.
- **React 19:** Últimas optimizaciones de acciones y hooks del ecosistema React.
- **Tailwind CSS 4:** Adopta la nueva arquitectura basada en motor CSS nativo (`@import "tailwindcss"`), eliminando la necesidad de archivos de configuración `tailwind.config.js` engorrosos y mejorando los tiempos de compilación de estilos.

### 3.7 Modelo de Datos: `empresa_id` en todas las tablas

- Toda tabla base (`servicios`, `profesionales`, `horarios`, `reservas`) incluye explícitamente `empresa_id`.
- **Razón técnica:** Permite validar permisos y pertenencia de datos directamente en cada query con un simple `WHERE empresa_id = :tenantId`, sin necesidad de realizar JOINs costosos hacia arriba en el árbol jerárquico.

### 3.8 Postergación Estratégica de WhatsApp y Pasarelas de Pago

- Tal como se validó en el proyecto Tangata, desacoplar servicios de terceros (APIs de WhatsApp, webhooks de pagos) durante la fase de cimientos evita acoplamientos prematuros y permite afinar primero el modelo de turnos, la latencia del API y la experiencia de usuario.

---

## 4. Consecuencias y Mitigaciones

- **Consecuencia positiva:** Flujo de desarrollo homogéneo, contratos de datos unificados con TypeScript, arranque instantáneo de base de datos con Docker y verificación automática en CI.
- **Trade-off:** La combinación de NestJS con ESM y Vitest requiere el uso del plugin `unplugin-swc` para mantener los metadatos de decoradores (`emitDecoratorMetadata`). Esto ha sido configurado y validado en `vitest.config.ts`.
