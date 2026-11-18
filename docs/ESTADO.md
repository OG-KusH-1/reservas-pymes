# Estado del proyecto

> **Para retomar el trabajo:** lee este archivo primero. Resume dónde va el
> proyecto, qué está decidido y qué falta. El diseño completo está en
> `docs/PLAN.md`; las reglas de trabajo, en `AGENTS.md`.

**Última actualización:** 2026-11-18 · **Fase en curso:** 1 (Identidad y empresa) · **Repositorio:** `reservas-pymes` (rama `main`)

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
| 1 Identidad y empresa         | **En curso**          | O1–O2 aprobadas (T10–T14)                    |
| 2 Catálogo y disponibilidad   | Pendiente             | —                                            |
| 3 Reservas y agenda           | Pendiente             | —                                            |
| 4 Reserva pública             | Pendiente             | —                                            |
| 5 Notificaciones              | Pendiente             | —                                            |
| 6 Gestión                     | Pendiente             | —                                            |
| 7 Endurecimiento y despliegue | Pendiente             | —                                            |
| 8 WhatsApp y pagos            | Posterior             | Sin tareas definidas                         |

## Fase 1: tareas y ejecutor

| Tarea                                                           | Ejecutor    | Estado   |
| --------------------------------------------------------------- | ----------- | -------- |
| T10 API de autenticación (O1)                                   | Antigravity | aprobada |
| T11 Web: registro e ingreso (O1)                                | Antigravity | aprobada |
| T12 API de miembros, invitaciones y cambio de empresa (O2)      | Antigravity | aprobada |
| T13 API de verificación y recuperación (O2)                     | Antigravity | aprobada |
| T14 Web: estructura del panel (O2)                              | Antigravity | aprobada |
| T15 API y web de configuración de la empresa (O3)               | Antigravity | asignada |
| T16 Web: equipo, invitaciones, recuperación y verificación (O3) | Antigravity | asignada |

## Pendientes y avisos

- **Siguiente paso:** ejecutar en paralelo la oleada F1-O3 (`T15`, `T16`)
  según `docs/tareas/README.md` (paso 2).
- **Remoto sin configurar.** El repositorio local tiene el historial y los
  commits de la Fase 0, pero falta enlazarlo con `reservas-pymes` y hacer el
  primer `push` (comandos en el `README.md`, sección «Repositorio»).
- **CI sin ejecutar.** `.github/workflows/ci.yml` correrá por primera vez con
  el primer `push`; revisar que termine en verde.
- **Imagen de Mailpit sin versión fija** (`axllent/mailpit:latest`) en
  `docker-compose.yml`; solo afecta al desarrollo local.
- **Acciones de GitHub fijadas por etiqueta**, no por SHA, y el CI no
  construye las imágenes Docker. Revisar en la Fase 7.
- **Política de contenido (CSP)** de la web: pendiente para la Fase 7.
- **Menores de F1-O1:** añadir prueba de `429` para `POST /auth/ingresar` en
  `apps/api/test/auth.int-spec.ts` y prueba E2E de flujo completo contra la API
  real cuando el entorno E2E levante ambos servidores.

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
| 2026-11-18 | Revisión de la oleada F1-O1 (T10 y T11): ambas aprobadas sin críticos ni importantes.                                                                                                                                                                                                      |
| 2026-11-18 | Preparada la oleada F1-O2 (T12, T13, T14): contratos `miembros.ts` y `cuenta.ts`, rutas, módulos base en `AppModule` y `@Publico()` en `errores-y-validacion.int-spec.ts`.                                                                                                                 |
| 2026-11-18 | Revisión de la oleada F1-O2 (T12, T13 y T14): todas aprobadas sin críticos ni importantes.                                                                                                                                                                                                 |
| 2026-11-18 | Preparada la oleada F1-O3 (T15, T16): contrato `empresa.ts`, módulo base `EmpresaModule` en `AppModule` y fichas `T15.md` y `T16.md`.                                                                                                                                                      |
