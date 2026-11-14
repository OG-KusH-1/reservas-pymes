# Plan de construcción — Agenda de servicios multiempresa

> **Estado:** aprobado el 2026-11-13.
> Este documento es la fuente de verdad del diseño y del reparto de tareas.
> El avance y los cambios respecto de este plan están en `docs/ESTADO.md`.

## A. Producto

Aplicación web SaaS para que negocios de servicios (peluquerías, centros de
kinesiología, estética, talleres) publiquen su agenda y reciban reservas en
línea, y para que su equipo administre el día a día desde un panel.

### A.1 Actores

| Actor                 | Acceso                     | Qué hace                                                               |
| --------------------- | -------------------------- | ---------------------------------------------------------------------- |
| Dueño / administrador | Panel, con cuenta          | Configura la empresa, servicios, equipo, horarios y políticas; ve todo |
| Profesional           | Panel, con cuenta          | Ve y gestiona su propia agenda y sus bloqueos                          |
| Recepción             | Panel, con cuenta          | Gestiona reservas y clientes de toda la empresa, sin configuración     |
| Cliente final         | Página pública, sin cuenta | Reserva, y luego cancela o reagenda con un enlace con token            |

### A.2 Alcance funcional

1. **Identidad:** registro de empresa con su dueño, inicio y cierre de sesión,
   recuperación de contraseña, verificación de correo, invitación de miembros,
   roles y permisos.
2. **Empresa:** perfil, slug público, zona horaria, políticas de reserva
   (anticipación mínima y máxima, ventana de cancelación, intervalo de la
   grilla, confirmación automática o manual).
3. **Catálogo:** servicios (duración, precio, tiempo de preparación posterior,
   categoría, visibilidad pública) y profesionales con los servicios que
   atiende cada uno.
4. **Disponibilidad:** horario semanal por profesional, bloqueos puntuales
   (vacaciones, colación, feriados) y motor de cálculo de horas libres.
5. **Reservas:** creación desde el panel y desde la página pública, estados
   (pendiente, confirmada, cancelada, completada, no asistió), reagendamiento,
   y garantía de no solapamiento a nivel de base de datos.
6. **Clientes:** ficha, historial de reservas y notas internas.
7. **Agenda:** calendario por día y por semana, con columnas por profesional.
8. **Página pública:** `/{slug}`, flujo en pasos (servicio → profesional →
   fecha y hora → datos → confirmación), optimizada para móvil y SEO.
9. **Notificaciones:** correo de confirmación, recordatorio, cancelación y
   reagendamiento, con archivo `.ics`; registro de envíos.
10. **Gestión:** panel de indicadores, exportación CSV y bitácora de auditoría.
11. **Posterior (Fase 8):** WhatsApp y pagos en línea, detrás de interfaces ya
    previstas (`NotificationChannel`, `PaymentProvider`).

## B. Arquitectura

### B.1 Estructura del monorepo

```
agenda/
├─ apps/
│  ├─ api/            NestJS 12 (ESM) — API REST /api/v1
│  └─ web/            Next.js 16 (App Router) — panel y página pública
├─ packages/
│  └─ contracts/      Esquemas Zod y tipos compartidos entre API y web
├─ docs/              PLAN, ESTADO, MODELO_DATOS, API, adr/, tareas/
└─ docker-compose.yml PostgreSQL 17, Redis, Mailpit
```

### B.2 Frameworks y librerías clave

Se conserva el stack del ADR 0001 y se agrega lo que falta para un producto
real. Cada adición relevante queda registrada en un ADR nuevo.

| Capa                      | Elección                                                                                                           | Motivo                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Contratos                 | `packages/contracts` con Zod                                                                                       | Una sola definición de cada DTO; la API valida y la web tipa y valida formularios con el mismo esquema   |
| Configuración             | `@nestjs/config` + esquema Zod de entorno                                                                          | La API no arranca con variables faltantes o inválidas; se eliminan credenciales por defecto en el código |
| Base de datos             | Drizzle como proveedor de Nest (token `DRIZZLE`)                                                                   | Inyectable y sustituible en pruebas; hoy es un singleton que se conecta al importarse                    |
| Migraciones               | `drizzle-kit generate` + `migrate`                                                                                 | Migraciones SQL versionadas; se abandona `push`                                                          |
| Antisolape                | Restricción `EXCLUDE` con `btree_gist` sobre profesional y rango horario                                           | La doble reserva es imposible aunque dos peticiones lleguen a la vez                                     |
| Autenticación             | Sesiones opacas en base de datos, cookie `httpOnly`, contraseñas con Argon2id                                      | Revocables, sin tokens en el navegador, sin dependencia de terceros                                      |
| Autorización              | Guard de roles y permisos + contexto de empresa obtenido de la sesión                                              | El `empresa_id` nunca viene del cliente                                                                  |
| Mismo origen              | La web reenvía `/api/*` a la API (rewrites de Next)                                                                | Cookies de primera parte, sin CORS en producción                                                         |
| Seguridad HTTP            | `helmet`, `@nestjs/throttler`, verificación de origen                                                              | Cabeceras seguras y límite de intentos en login y endpoints públicos                                     |
| Errores                   | Filtro global con formato único (`codigo`, `mensaje`, `detalles`, `traceId`)                                       | La web maneja errores de forma uniforme                                                                  |
| Registro                  | `nestjs-pino` (JSON estructurado, id por petición)                                                                 | Trazabilidad en producción                                                                               |
| Documentación de API      | OpenAPI generado desde los esquemas Zod (adaptador propio, ADR 0002)                                               | Documentación siempre sincronizada con la validación                                                     |
| Fechas                    | Luxon; todo se guarda en UTC y cada empresa tiene zona horaria IANA                                                | Los cálculos de disponibilidad respetan cambios de hora                                                  |
| Trabajos en segundo plano | BullMQ + Redis                                                                                                     | Recordatorios programados con reintentos                                                                 |
| Correo                    | Nodemailer por SMTP; Mailpit en desarrollo                                                                         | Proveedor intercambiable por variables de entorno                                                        |
| Interfaz                  | Tailwind 4 con tokens de tema + shadcn/ui (Radix)                                                                  | Componentes accesibles y consistentes, con el código dentro del repositorio                              |
| Datos en la web           | TanStack Query + cliente de API tipado                                                                             | Caché, reintentos e invalidación tras cada mutación                                                      |
| Formularios               | React Hook Form + resolver de Zod                                                                                  | Misma validación en cliente y servidor                                                                   |
| Calendario                | Grilla propia día/semana sobre CSS Grid                                                                            | Las vistas por recurso de las librerías conocidas son de pago                                            |
| Pruebas                   | Vitest; integración de API contra PostgreSQL real (Testcontainers); Testing Library con jsdom; Playwright para E2E | Cada nivel cubre lo que el anterior no puede                                                             |
| Calidad                   | Prettier, ESLint (typescript-eslint + reglas de Next), `tsc --noEmit`, Husky + lint-staged + commitlint            | Las reglas de `AGENTS.md` pasan a cumplirse de forma automática                                          |
| Entrega                   | Dockerfiles multietapa; CI con PostgreSQL, verificación de tipos, formato, pruebas, build y E2E                    | Lo que pasa el CI es desplegable                                                                         |

### B.3 Modelo de datos (versión 1)

Todas las tablas salvo `empresas`, `usuarios` y `tokens_verificacion` llevan `empresa_id`
con índice. Identificadores de dominio en español, como en los cimientos.

| Tabla                     | Propósito                                           | Notas                                                                                                                                          |
| ------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `empresas`                | Tenant                                              | Se agregan `zona_horaria`, `moneda` y políticas de reserva                                                                                     |
| `usuarios`                | Cuentas del panel                                   | Correo único, hash Argon2id, verificación de correo                                                                                            |
| `sesiones`                | Sesiones activas                                    | Token guardado como hash, vencimiento, revocación                                                                                              |
| `miembros`                | Usuario ↔ empresa con rol                           | Roles: `dueno`, `admin`, `recepcion`, `profesional`                                                                                            |
| `invitaciones`            | Invitación de miembros                              | Token de un solo uso con vencimiento                                                                                                           |
| `tokens_verificacion`     | Verificación de correo y recuperación de contraseña | Hash del token, tipo, vencimiento                                                                                                              |
| `servicios`               | Catálogo                                            | Se agregan categoría, margen posterior, visibilidad pública, color                                                                             |
| `profesionales`           | Quien atiende                                       | Vínculo opcional a `usuarios`                                                                                                                  |
| `profesionales_servicios` | Qué servicios atiende cada profesional              | Clave compuesta                                                                                                                                |
| `horarios`                | Disponibilidad semanal                              | Tipo `time`, `CHECK` de día 0–6 y de inicio < fin                                                                                              |
| `bloqueos`                | Excepciones de disponibilidad                       | Rango `timestamptz`; profesional nulo = toda la empresa                                                                                        |
| `clientes`                | Clientes finales                                    | Únicos por empresa y correo; notas internas                                                                                                    |
| `reservas`                | Citas                                               | `cliente_id`, estado como enum, precio y duración copiados al reservar, token de gestión, origen (`panel` / `publico`), restricción antisolape |
| `notificaciones`          | Registro de envíos                                  | Canal, plantilla, estado, intentos                                                                                                             |
| `auditoria`               | Bitácora de acciones                                | Actor, acción, entidad, antes y después                                                                                                        |

### B.4 Reglas transversales

- **Aislamiento:** toda consulta filtra por la empresa de la sesión. La Fase 7
  añade seguridad a nivel de fila (RLS) en PostgreSQL como segunda barrera.
- **Idioma:** dominio y textos en español; código de infraestructura en inglés.
- **Comentarios:** TSDoc en español en funciones, servicios, guards, esquemas
  y cálculos importantes: qué hace, por qué se hizo así, qué cuidar al
  modificarlo y cómo extenderlo. Sin comentarios que repitan el código.
- **Dinero:** enteros en la unidad mínima de la moneda (CLP sin decimales).
- **API:** prefijo `/api/v1`, paginación por cursor, errores con código estable.

## C. Reparto de trabajo

| Quién                | Qué                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Exploradores (Haiku) | Lectura y resumen de código                                                                                  |
| Claude (Fable)       | Planificación y Fase 0 completa (hecho). Desde la Fase 1 su participación es opcional                        |
| Antigravity          | Fases 1 a 7 completas, por oleadas, con tres roles: preparador, ejecutor y revisor (`docs/tareas/README.md`) |
| Revisor              | Un agente por oleada, según `docs/REVISION.md`                                                               |

Las tareas ya escritas están en `docs/tareas/T<n>.md` y las futuras, en
`docs/tareas/BACKLOG.md`. Si interviene Claude Code, nunca invoca la CLI de
Antigravity: el traspaso es siempre por archivos.

Reglas de colisión: máximo cuatro tareas por oleada; dos tareas de una misma
oleada nunca comparten archivos; `packages/contracts`, el esquema de base de
datos, las migraciones, `app.module.ts`, los `package.json` y el CI tienen
dueño único por oleada, indicado en cada tarea.

## D. Fases y tareas

Una tarea depende solo de oleadas anteriores. Revisión al cierre de cada
oleada.

### Fase 0 — Infraestructura (ejecutor: Claude)

Criterio de salida: `pnpm lint`, `typecheck`, `test` y `build` en verde;
`docker compose up` levanta PostgreSQL, Redis y Mailpit; migraciones y seed
aplican; la web muestra la base del panel con el tema definitivo.

| ID  | Tarea                                                                                                                                                                                                                          | Ol. | Depende |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------- |
| T1  | Herramientas de raíz: Prettier, EditorConfig, `engines`, `.nvmrc`, ESLint compartido, Husky, lint-staged, commitlint, scripts `typecheck` y `format`                                                                           | O1  | —       |
| T2  | `packages/contracts`: build, esquemas base (error, paginación, health, enums de dominio)                                                                                                                                       | O2  | T1      |
| T3  | Núcleo de la API: configuración validada, `DatabaseModule`, pino, helmet, throttler, filtro de errores, validación Zod global, OpenAPI, `/api/v1`, puerto de correo, apagado ordenado                                          | O3  | T2      |
| T4  | Núcleo de la web: tokens de tema, shadcn/ui, tipografía, TanStack Query, cliente de API tipado, React Hook Form, rewrites, grupos de rutas `(auth)`, `(panel)`, `(publico)`, páginas de error y carga, jsdom + Testing Library | O3  | T2      |
| T5  | Docker: Redis y Mailpit en compose, Dockerfiles multietapa, `.dockerignore`, `.env.example` comentado                                                                                                                          | O3  | T1      |
| T6  | Modelo de datos v1: esquema completo, migraciones reales, restricción antisolape, índices, seed idempotente                                                                                                                    | O4  | T3      |
| T7  | Infraestructura de pruebas de la API: módulo de pruebas, PostgreSQL con Testcontainers, fábricas de datos                                                                                                                      | O4  | T3      |
| T8  | CI: formato, tipos, pruebas unitarias, de integración y E2E, build; base de Playwright                                                                                                                                         | O5  | T6, T7  |
| T9  | Documentación: `AGENTS.md` ampliado, `docs/tareas/` (README y plantilla), `ESTADO.md`, `MODELO_DATOS.md`, `API.md`, ADR 0002                                                                                                   | O5  | T6      |

### Fase 1 — Identidad y empresa (Antigravity)

Criterio de salida: una persona registra su empresa, inicia sesión, invita a
un miembro y edita la configuración; ninguna ruta del panel abre sin sesión.

| ID  | Tarea                                                                                                                    | Ol. | Depende       |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --- | ------------- |
| T10 | API de autenticación: registro de empresa y dueño, login, logout, sesión actual, guard, decoradores de usuario y empresa | O1  | F0            |
| T11 | Web: pantallas de registro e inicio de sesión                                                                            | O1  | F0            |
| T12 | API de roles y permisos, miembros e invitaciones                                                                         | O2  | T10           |
| T13 | API de verificación de correo y recuperación de contraseña                                                               | O2  | T10           |
| T14 | Web: estructura del panel (navegación, protección de rutas, menú de usuario)                                             | O2  | T10, T11      |
| T15 | API y web de configuración de la empresa y políticas de reserva                                                          | O3  | T12, T14      |
| T16 | Web: equipo, invitaciones, recuperación y verificación                                                                   | O3  | T12, T13, T14 |

### Fase 2 — Catálogo y disponibilidad (Antigravity)

Criterio de salida: con servicios, profesionales y horarios cargados, la API
devuelve las horas libres correctas, incluidos bloqueos y cambios de hora.

| ID  | Tarea                                                                                     | Ol. | Depende  |
| --- | ----------------------------------------------------------------------------------------- | --- | -------- |
| T17 | API de servicios                                                                          | O1  | F1       |
| T18 | API de profesionales y asignación de servicios                                            | O1  | F1       |
| T19 | API de horarios semanales y bloqueos                                                      | O2  | T18      |
| T20 | Web: servicios                                                                            | O2  | T17      |
| T21 | Web: profesionales                                                                        | O2  | T18      |
| T22 | Motor de disponibilidad (función pura con pruebas exhaustivas) y endpoint de horas libres | O3  | T17, T19 |
| T23 | Web: horarios y bloqueos                                                                  | O3  | T19, T21 |

### Fase 3 — Reservas y agenda (Antigravity)

Criterio de salida: recepción crea, mueve y cancela reservas en el
calendario; dos reservas simultáneas para la misma hora nunca se aceptan.

| ID  | Tarea                                                                                      | Ol. | Depende  |
| --- | ------------------------------------------------------------------------------------------ | --- | -------- |
| T24 | API de clientes                                                                            | O1  | F2       |
| T25 | API de reservas: creación, transiciones de estado, reagendamiento, cancelación, antisolape | O1  | F2       |
| T26 | Web: calendario día y semana por profesional                                               | O2  | T25      |
| T27 | Web: clientes (lista, ficha, historial)                                                    | O2  | T24      |
| T28 | Web: crear y editar reserva desde el calendario                                            | O3  | T26, T27 |

### Fase 4 — Reserva pública (Antigravity)

Criterio de salida: un cliente reserva desde el celular en `/{slug}` y puede
cancelar o reagendar desde su enlace.

| ID  | Tarea                                                                                                               | Ol. | Depende |
| --- | ------------------------------------------------------------------------------------------------------------------- | --- | ------- |
| T29 | API pública: empresa por slug, catálogo, horas libres, creación de reserva, gestión por token, límite de peticiones | O1  | F3      |
| T30 | Web: página pública y flujo de reserva en pasos                                                                     | O2  | T29     |
| T31 | Web: gestión de la reserva por enlace                                                                               | O2  | T29     |
| T32 | SEO: metadatos, Open Graph, datos estructurados, sitemap                                                            | O3  | T30     |

### Fase 5 — Notificaciones (Antigravity)

Criterio de salida: cada reserva genera correo de confirmación con `.ics` y
un recordatorio programado; los envíos quedan registrados.

| ID  | Tarea                                                               | Ol. | Depende  |
| --- | ------------------------------------------------------------------- | --- | -------- |
| T33 | Colas BullMQ, proceso trabajador y canal de notificación por correo | O1  | F4       |
| T34 | Plantillas de correo y archivo `.ics`                               | O1  | F4       |
| T35 | Programación de recordatorios y configuración por empresa           | O2  | T33, T34 |
| T36 | Web: registro de notificaciones y reenvío                           | O3  | T35      |

### Fase 6 — Gestión (Antigravity)

| ID  | Tarea                                                   | Ol. | Depende |
| --- | ------------------------------------------------------- | --- | ------- |
| T37 | API de indicadores (ocupación, ingresos, inasistencias) | O1  | F5      |
| T38 | Bitácora de auditoría                                   | O1  | F5      |
| T39 | Web: panel de indicadores                               | O2  | T37     |
| T40 | Exportación CSV y vista de auditoría                    | O2  | T38     |

### Fase 7 — Endurecimiento y despliegue (Antigravity, con Claude en RLS)

| ID  | Tarea                                                              | Ol. | Depende |
| --- | ------------------------------------------------------------------ | --- | ------- |
| T41 | Seguridad a nivel de fila (RLS) en PostgreSQL                      | O1  | F6      |
| T42 | Pruebas E2E de los flujos críticos                                 | O1  | F6      |
| T43 | Accesibilidad y diseño adaptable                                   | O1  | F6      |
| T44 | Observabilidad: liveness y readiness, métricas, reporte de errores | O2  | T41     |
| T45 | Despliegue: imágenes, compose de producción, guía de operación     | O2  | T42     |

### Fase 8 — Posterior

WhatsApp y pagos en línea. Sin tareas definidas hasta cerrar la Fase 7.

## E. Decisiones abiertas

1. **Repositorio git.** Resuelto: repositorio propio `reservas-pymes`.
2. **Proveedor de correo en producción** (cualquier SMTP sirve). Se decide en
   la Fase 5.
3. **Destino de despliegue.** Se decide en la Fase 7.
