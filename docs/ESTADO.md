# Estado del proyecto

> **Para retomar el trabajo:** lee este archivo primero. Resume dónde va el
> proyecto, qué está decidido y qué falta. El diseño completo está en
> `docs/PLAN.md`; las reglas de trabajo, en `AGENTS.md`.

**Última actualización:** 2026-11-13 · **Fase en curso:** 1 (Identidad y empresa) · **Repositorio:** `reservas-pymes` (rama `main`)

## Decisiones vigentes

| Tema                   | Decisión                                                                                           | Dónde                    |
| ---------------------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| Reparto                | Antigravity hace todo el ciclo por oleadas: preparar, ejecutar y revisar. Claude Code es opcional  | `docs/tareas/README.md`  |
| Tareas futuras         | Especificadas en `docs/tareas/BACKLOG.md`; el preparador las detalla al llegar su oleada           | `docs/tareas/BACKLOG.md` |
| Git                    | Un commit por tarea, solo de sus archivos, en la rama actual; el `push` lo hace la persona usuaria | `AGENTS.md` §2 y §7      |
| Contratos              | Esquemas Zod compartidos en `packages/contracts`                                                   | ADR 0002 §1              |
| Validación en Nest     | Adaptador propio (`nestjs-zod` no soporta NestJS 12)                                               | ADR 0002 §2              |
| Doble reserva          | Restricción `EXCLUDE` en PostgreSQL                                                                | `docs/MODELO_DATOS.md`   |
| Autenticación          | Sesiones opacas en base de datos, cookie `httpOnly`, Argon2id                                      | ADR 0002 §5              |
| Mismo origen           | La web reenvía `/api/*` a la API                                                                   | ADR 0002 §6              |
| Pruebas de integración | PostgreSQL real con Testcontainers, también en CI                                                  | ADR 0002 §7              |
| Comentarios            | TSDoc en español en todo el código importante                                                      | `AGENTS.md` §3           |

## Avance por fase

| Fase                          | Estado                | Notas                                        |
| ----------------------------- | --------------------- | -------------------------------------------- |
| 0 Infraestructura             | **Terminada** (T1–T9) | Verificación completa en verde; ver bitácora |
| 1 Identidad y empresa         | **En curso**          | O1 asignada (T10, T11)                       |
| 2 Catálogo y disponibilidad   | Pendiente             | —                                            |
| 3 Reservas y agenda           | Pendiente             | —                                            |
| 4 Reserva pública             | Pendiente             | —                                            |
| 5 Notificaciones              | Pendiente             | —                                            |
| 6 Gestión                     | Pendiente             | —                                            |
| 7 Endurecimiento y despliegue | Pendiente             | —                                            |
| 8 WhatsApp y pagos            | Posterior             | Sin tareas definidas                         |

## Fase 1: tareas y ejecutor

| Tarea                            | Ejecutor    | Estado              |
| -------------------------------- | ----------- | ------------------- |
| T10 API de autenticación (O1)    | Antigravity | asignada            |
| T11 Web: registro e ingreso (O1) | Antigravity | asignada            |
| T12, T13, T14 (O2)               | Antigravity | pendiente (BACKLOG) |
| T15, T16 (O3)                    | Antigravity | pendiente (BACKLOG) |

## Pendientes y avisos

- **Siguiente paso:** lanzar en Antigravity los ejecutores de T10 y T11 y
  luego el revisor de la oleada F1-O1 (mensajes en `docs/tareas/README.md`).
- **Remoto sin configurar.** El repositorio local tiene el historial y los
  commits de la Fase 0, pero falta enlazarlo con `reservas-pymes` y hacer el
  primer `push` (comandos en el `README.md`, sección «Repositorio»).
- **CI sin ejecutar.** `.github/workflows/ci.yml` correrá por primera vez con
  el primer `push`; revisar que termine en verde.
- **Imagen de Mailpit sin versión fija** (`axllent/mailpit:latest`) en
  `docker-compose.yml`; solo afecta al desarrollo local.
- **Acciones de GitHub fijadas por etiqueta**, no por SHA, y el CI no
  construye las imágenes Docker. Revisar en la Fase 7.
- **Al integrar T10:** las pruebas de `errores-y-validacion.int-spec.ts` usan
  un controlador sin sesión; habrá que marcarlo `@Publico()` cuando exista el
  guard global.
- **Política de contenido (CSP)** de la web: pendiente para la Fase 7.
- **Arranque en frío de las pruebas E2E.** En Windows, la primera ejecución
  tras un `pnpm build` puede ser lenta o necesitar el reintento automático
  (ver comentario en `apps/web/playwright.config.ts`); con el servidor ya
  iniciado las 6 pruebas tardan unos 5 segundos.

## Cambios respecto del plan aprobado

- T5/T8: el CI no usa un servicio de PostgreSQL; las pruebas de integración
  levantan el suyo con Testcontainers (mismo mecanismo que en local).
- T3: se usa un adaptador propio de Zod en lugar de `nestjs-zod`.

## Bitácora

| Fecha      | Hito                                                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-13 | Diagnóstico de los cimientos con exploradores; plan aprobado.                                                                                                                                                                                                                              |
| 2026-11-13 | Fase 0 terminada: herramientas, contratos, núcleo de API y web, modelo de datos v1, Docker, CI, documentación.                                                                                                                                                                             |
| 2026-11-13 | Revisión de la Fase 0: sin críticos en el código; corregidos los hallazgos importantes (secretos en la imagen Docker, apagado ordenado, datos personales en registros, índices, mensajes de validación en español, pruebas del filtro y la validación) y las contradicciones de T10 y T11. |
| 2026-11-13 | Preparada la oleada F1-O1 (T10, T11).                                                                                                                                                                                                                                                      |
| 2026-11-13 | Repositorio propio con el historial previo; hooks de git activados; protocolo autónomo para Antigravity (preparador, ejecutor, revisor) y BACKLOG de T12–T45.                                                                                                                              |
