# AGENTS.md — Reglas para agentes y personas que desarrollan en este repositorio

Estas reglas son obligatorias para cualquier agente de IA (Antigravity, Claude
Code u otro) y para cualquier persona que modifique el código. Si una
instrucción de una tarea contradice este archivo, gana la tarea solo cuando lo
dice de forma explícita en «Notas del orquestador».

## 1. Antes de empezar

1. Lee completo el archivo de tu tarea (`docs/tareas/T<n>.md`).
2. Lee lo que la tarea cite en «Contexto que debes leer». Como mínimo:
   - `docs/PLAN.md` §B (arquitectura y reglas transversales);
   - `docs/API.md` (convenciones de la API) si tocas `apps/api` o consumes endpoints;
   - `docs/MODELO_DATOS.md` si lees o escribes en la base de datos.
3. Mira el código existente que la tarea indica reutilizar. No reimplementes
   lo que ya existe (cliente de API, formato de fechas, filtro de errores,
   fábricas de pruebas…).
4. Prepara el entorno: `pnpm install`, `cp .env.example .env`,
   `pnpm infra:up`, `pnpm db:migrate`, `pnpm db:seed`.

## 2. Mientras trabajas

### Alcance

- Crea o modifica **solo** los archivos listados en «Archivos permitidos» de
  tu tarea. Otras tareas corren en paralelo sobre otros archivos.
- Si necesitas un cambio fuera de tu alcance (una columna nueva, un código de
  error, una dependencia), **no lo hagas**: descríbelo en «Preguntas /
  pendientes» de tu entrega. Esos cambios de base común los hace el preparador.
- No agregues ni actualices dependencias, salvo que la tarea lo autorice.

### Git

- Trabaja sobre la rama actual. No cambies de rama, no hagas `push`, `merge`,
  `rebase`, `reset`, `stash` ni `commit --amend`: otros agentes comparten este
  mismo directorio de trabajo y les romperías el suyo.
- Haz commit **solo de tus archivos** y solo al terminar (ver §7). Nunca uses
  `git add -A` ni `git add .`: agregarías el trabajo a medias de otra tarea.
- No uses `--no-verify`. Si un hook falla, corrige la causa.

### Secretos

- Nunca escribas credenciales, tokens ni datos personales reales en el código,
  las pruebas, los registros o la documentación.
- La configuración entra solo por variables de entorno validadas en
  `apps/api/src/config/env.ts`. Ningún otro archivo de la API lee `process.env`.

### Idioma

- Dominio en español: tablas, columnas, DTO, rutas de la API y de la web,
  textos de interfaz, mensajes de error, comentarios y documentación.
- Infraestructura en inglés, siguiendo a cada framework: sufijos de archivos de
  Nest (`.controller`, `.service`, `.module`), nombres de hooks (`useAlgo`),
  componentes de shadcn/ui.

## 3. Comentarios de código (obligatorio)

El código importante debe quedar documentado para quien lo mantenga o lo
amplíe sin haber participado en su creación. Se escribe TSDoc (`/** … */`) en
español.

**Qué documentar siempre:**

- Servicios, guards, pipes, filtros, interceptores y decoradores de la API.
- Funciones con reglas de negocio o cálculos (disponibilidad, transiciones de
  estado, permisos, fechas y zonas horarias, dinero).
- Esquemas de `@portfolio/contracts`, tablas y restricciones de la base de datos.
- Hooks de datos y componentes con estado o lógica no trivial.
- Toda decisión que parezca extraña a primera vista.

**Qué debe decir el comentario** (lo que aplique):

1. **Qué** hace, en una frase, en términos del negocio.
2. **Por qué** está hecho así: la restricción, el caso borde o la alternativa
   descartada. Es la parte más valiosa.
3. **Qué cuidar al modificarlo**: invariantes, efectos sobre otros módulos,
   orden de operaciones, condiciones de carrera.
4. **Cómo extenderlo**: dónde agregar el caso siguiente.
5. `@throws` con los errores de negocio que puede lanzar y `@example` cuando el
   uso no sea evidente.

**Qué no hacer:**

- No repitas el código en palabras (`// incrementa el contador`).
- No dejes código comentado, ni `TODO` sin número de tarea.
- No documentes componentes puramente visuales ni getters triviales.
- No describas la historia del cambio («antes hacía X»): eso va en el commit.

Ejemplos del nivel esperado: `apps/api/src/common/errors/all-exceptions.filter.ts`,
`apps/api/src/db/schema.ts`, `apps/web/lib/api/core.ts`, `apps/web/lib/formato.ts`.

## 4. Convenciones del stack

### Contratos (`packages/contracts`)

- Todo dato que cruza la red se define aquí como esquema Zod; los tipos se
  derivan con `z.infer`. La API valida con el esquema y la web lo reutiliza.
- Un archivo por módulo funcional (`auth.ts`, `servicios.ts`), reexportado
  desde `index.ts`. Reutiliza las piezas de `comunes.ts`.
- Nombres: `crearServicioSchema` / `CrearServicio`, `servicioSchema` / `Servicio`.
- Tras modificarlo: `pnpm contracts:build` (`pnpm dev` lo hace solo).

### API (`apps/api`) — detalle en `docs/API.md`

- Un módulo de Nest por área, en `src/<area>/`: `*.module.ts`,
  `*.controller.ts`, `*.service.ts`, `*.dto.ts`, pruebas junto al código.
- **Aislamiento multiempresa:** toda consulta filtra por el `empresa_id` de la
  sesión. Ese valor nunca se toma del cuerpo, la URL ni la cadena de consulta.
  Un recurso de otra empresa responde 404, no 403.
- **Validación:** DTO creados con `createZodDto(esquema)`; el pipe global valida.
- **Errores:** lanza `AppException` con un código de `CODIGOS_ERROR`. No uses
  las excepciones HTTP de Nest ni devuelvas errores a mano.
- **Base de datos:** inyecta con `@Inject(DRIZZLE) db: Database`. Operaciones de
  varios pasos, en `db.transaction`. Cambios de esquema: edita
  `src/db/schema.ts`, ejecuta `pnpm db:generate` y revisa el SQL. Nunca edites
  una migración ya aplicada.
- **Importaciones:** con extensión `.js` (módulos ES). Las clases que Nest
  inyecta se importan como valor, no con `import type`.
- **Registro:** `Logger` de Nest. Nunca registres contraseñas, tokens, cookies
  ni datos personales.

### Web (`apps/web`)

- App Router. Componentes de servidor por defecto; `'use client'` solo donde
  haya estado, efectos o eventos.
- Rutas en `lib/rutas.ts`; toda ruta nueva de primer nivel se agrega también a
  `SLUGS_RESERVADOS` en contratos.
- **Datos:** `api` (`lib/api/client.ts`) con TanStack Query en el cliente;
  `apiServidor` (`lib/api/server.ts`) en el servidor. Un hook por recurso en
  `hooks/` (plantilla: `hooks/use-salud.ts`). No uses `fetch` directo.
- **Formularios:** React Hook Form + `zodResolver` con el esquema de
  contratos; errores del servidor con `aplicarErroresAlFormulario`.
- **Interfaz:** componentes de `components/ui` (shadcn/ui; no se editan a mano,
  se agregan con `pnpm dlx shadcn@latest add <componente>`). Colores solo con
  clases semánticas (`bg-background`, `text-muted-foreground`, `bg-primary`).
- **Fechas y dinero:** siempre con `lib/formato.ts`, en la zona horaria de la
  empresa. Nunca `toLocaleString()` ni la zona del navegador.
- **Estados:** toda vista con datos remotos contempla carga, error y vacío.
- **Accesibilidad:** HTML semántico, etiquetas en todos los campos, foco
  visible, navegable con teclado, contraste AA.
- **Diseño adaptable:** primero móvil; verifica en 375 px y en escritorio.

### Pruebas

- Unitarias (`*.spec.ts`, junto al código): lógica pura y componentes.
- Integración de la API (`*.int-spec.ts`): contra PostgreSQL real, con
  `crearAppDePrueba()` y las fábricas de `apps/api/test/`. Requieren Docker.
- Toda regla de negocio lleva pruebas del caso feliz, de los casos borde y de
  los errores. Todo endpoint lleva una prueba de aislamiento: una empresa no
  puede leer ni modificar datos de otra.
- Nombres de las pruebas en español, describiendo el comportamiento.

## 5. Verificación obligatoria

Antes de entregar, desde la raíz y con todo en verde:

```bash
pnpm format        # aplica el formato
pnpm lint
pnpm typecheck
pnpm test
pnpm test:int      # si tocaste apps/api (requiere Docker)
pnpm build
```

Si algo falla por código ajeno a tu tarea, repórtalo en la entrega; no lo
arregles ni lo desactives. Está prohibido saltarse una prueba (`.skip`),
silenciar una regla (`eslint-disable`, `@ts-ignore`, `any`) o bajar un umbral
para pasar la verificación.

## 6. Cómo entregar

1. Completa la sección «Entrega» de tu archivo de tarea:
   - **Estado:** `entregada`.
   - **Archivos creados/modificados:** lista completa.
   - **Verificación:** comandos ejecutados y resultado, con el número de pruebas.
   - **Decisiones y supuestos:** lo que resolviste por tu cuenta y por qué.
   - **Preguntas / pendientes:** lo que quedó fuera o necesita un cambio de base común.
2. Cambia `estado: asignada` por `estado: entregada` en el encabezado.
3. No modifiques la sección «Revisión»: la completa el revisor.
4. Haz el commit (§7).

## 7. Commits

Un commit por tarea, con tus archivos y tu archivo de tarea:

```bash
git add <cada archivo que creaste o modificaste> docs/tareas/T<n>.md
git commit -m "feat(api): autenticacion por sesion (T10)"
```

- Conventional Commits en español y en minúsculas: `tipo(ámbito): descripción (T<n>)`.
- Tipos: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`.
- Ámbitos: `api`, `web`, `contracts`, `root`.
- Los hooks aplican Prettier a lo que agregas y validan el mensaje.
- Si `git status` muestra cambios en archivos que no son tuyos, déjalos: son de otra tarea en curso.

## 8. Roles

Además del **ejecutor** de una tarea (todo lo anterior), hay dos roles que se
lanzan por oleada. Sus instrucciones están en:

- **Preparador:** `docs/tareas/README.md`, paso 1. Es el único que hace
  cambios de base común y escribe los archivos de tarea.
- **Revisor:** `docs/REVISION.md`. Solo reporta; no modifica código.
