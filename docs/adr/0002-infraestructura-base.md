# ADR 0002 — Infraestructura base de la Fase 0

- **Estado:** Aceptado
- **Fecha:** 2026-11-13
- **Complementa:** ADR 0001 (stack)

## Contexto

Los cimientos tenían el stack elegido (ADR 0001) pero no la infraestructura
que un producto real necesita antes de escribir funcionalidades: contratos
compartidos, configuración validada, manejo de errores, autenticación,
garantías de integridad en la base de datos y pruebas contra dependencias
reales. Este ADR registra las decisiones tomadas al construirla.

## Decisiones

### 1. Contratos compartidos con Zod 4 (`packages/contracts`)

Cada dato que cruza la red se define una vez como esquema Zod. La API valida
con él y la web lo usa para tipar respuestas y validar formularios.

- _Alternativa descartada:_ generar un cliente desde OpenAPI. Agrega un paso
  de generación y los tipos llegan tarde; con un monorepo TypeScript el
  esquema compartido es más directo.
- _Costo:_ el paquete se compila a `dist/` y hay que recompilarlo al cambiarlo
  (`pnpm dev` lo hace en modo observación).

### 2. Adaptador propio de Zod para Nest en lugar de `nestjs-zod`

`nestjs-zod` no declara compatibilidad con NestJS 12. Se escribió un adaptador
mínimo en `apps/api/src/common/zod` (unas 150 líneas): `createZodDto`, un pipe
global y decoradores que generan OpenAPI con `z.toJSONSchema`.

- _Revisar cuando:_ `nestjs-zod` soporte NestJS 12; migrar es mecánico porque
  la interfaz (`createZodDto`) es la misma.

### 3. Doble reserva impedida por la base de datos

Restricción `EXCLUDE` con `btree_gist` sobre `(profesional_id, rango horario)`.
Es la única forma de garantizarlo ante peticiones simultáneas; una validación
en la aplicación siempre tiene una ventana entre consultar y escribir.

- _Alternativa descartada:_ bloqueos explícitos (`SELECT … FOR UPDATE`) o
  transacciones serializables. Funcionan, pero dependen de que todo el código
  presente y futuro los use bien.
- _Costo:_ Drizzle no modela `EXCLUDE`; la restricción vive en una migración
  manual documentada en `docs/MODELO_DATOS.md`.

### 4. Migraciones versionadas en lugar de `drizzle-kit push`

`push` no deja historial ni admite SQL manual. Las migraciones se generan con
`drizzle-kit generate` y se aplican con un script propio (`src/db/migrate.ts`)
que usan por igual desarrollo, pruebas y el contenedor de producción.

### 5. Sesiones opacas en base de datos, no JWT

Cookie `httpOnly` con un token aleatorio cuyo hash se guarda en `sesiones`.

- _Por qué:_ se pueden revocar al instante (cierre de sesión, cambio de
  contraseña, baja de un miembro) y el navegador nunca maneja el token.
- _Alternativa descartada:_ JWT de acceso y de refresco. Añade rotación y
  listas de revocación para llegar al mismo resultado.
- _Costo:_ una consulta por petición, asumible a esta escala.

### 6. Web y API en el mismo origen mediante rewrites

Next reenvía `/api/*` a la API. La cookie es de primera parte y desaparecen
CORS y las peticiones de verificación previa.

- _Costo:_ la dirección de la API se fija al compilar la web (`API_URL`).

### 7. Pruebas de integración contra PostgreSQL real (Testcontainers)

Lo esencial del sistema (antisolape, `CHECK`, enumeraciones) vive en
PostgreSQL; un sustituto en memoria no lo probaría. El mismo mecanismo corre
en local y en CI, por lo que el CI no declara un servicio de base de datos.

- _Costo:_ requieren Docker y tardan más; por eso están separadas de las
  unitarias (`pnpm test:int`).

### 8. Ejecución de la API en desarrollo con SWC

Nest necesita los metadatos de decoradores y esbuild (`tsx`) no los emite: la
inyección de dependencias fallaría en silencio. `pnpm dev` usa
`@swc-node/register`. `tsx` se conserva solo para scripts sin decoradores
(migraciones y seed).

### 9. Calendario propio en lugar de una librería

Las vistas por recurso (una columna por profesional) de las librerías de
calendario conocidas son de pago. La agenda se construirá sobre CSS Grid
(tarea T26).

### 10. Redis y BullMQ para trabajos en segundo plano

Recordatorios programados con reintentos. Redis ya está en `docker compose`;
BullMQ se instala en la Fase 5.

- _Alternativa considerada:_ una cola sobre PostgreSQL (un servicio menos).
  Se prefirió BullMQ por su integración con Nest y sus herramientas.

## Pendiente de decisión

- Activación de los hooks de git (Husky): depende de definir el repositorio
  de este proyecto (ver `docs/ESTADO.md`).
- Proveedor de correo en producción (Fase 5) y destino de despliegue (Fase 7).
