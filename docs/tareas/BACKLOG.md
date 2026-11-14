# Backlog de tareas (T12–T45)

Especificación de cada tarea aún no escrita. El **preparador**
(`docs/tareas/README.md`, paso 1) la convierte en un archivo `T<n>.md`
detallado cuando llega su oleada, ajustándola al código ya entregado.

Convenciones de este documento:

- **Base común:** lo que el preparador debe dejar hecho antes de asignar la
  oleada (contratos, esquema, dependencias, rutas).
- **Reglas:** decisiones de negocio ya tomadas; no se reabren.
- **Pruebas:** lo mínimo exigible, además de la prueba de aislamiento entre
  empresas que lleva todo endpoint (`AGENTS.md` §4).
- Rutas de API relativas a `/api/v1`. Roles: `dueno`, `admin`, `recepcion`, `profesional`.

Permisos por defecto en el panel, salvo que la tarea diga otra cosa:

| Recurso                                         | Lectura                                                   | Escritura                                      |
| ----------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Configuración, equipo, servicios, profesionales | todos                                                     | `dueno`, `admin`                               |
| Horarios y bloqueos                             | todos                                                     | `dueno`, `admin`; `profesional` solo los suyos |
| Clientes y reservas                             | `dueno`, `admin`, `recepcion`; `profesional` solo lo suyo | igual que lectura                              |
| Indicadores, auditoría, exportaciones           | `dueno`, `admin`                                          | —                                              |

---

## Fase 1 — Identidad y empresa

### Oleada F1-O2 (T12, T13, T14)

**Base común:** contratos `miembros.ts` y `cuenta.ts`; marcar `@Publico()` el
controlador de `apps/api/test/errores-y-validacion.int-spec.ts`; rutas nuevas
en `lib/rutas.ts` y `SLUGS_RESERVADOS` (`recuperar`, `verificar`, `invitacion`
ya están reservados).

#### T12 — API de miembros, invitaciones y cambio de empresa

- **Archivos:** `apps/api/src/miembros/**`, `apps/api/test/miembros.int-spec.ts`.
- **Endpoints:** `GET /miembros`; `PATCH /miembros/:id` (rol, activo);
  `DELETE /miembros/:id`; `GET|POST /invitaciones`; `DELETE /invitaciones/:id`;
  `GET /publico/invitaciones/:token` (datos mínimos para la pantalla);
  `POST /publico/invitaciones/:token/aceptar` (crea el usuario si no existe,
  o lo une si ya tiene cuenta e inició sesión con ese correo);
  `GET /auth/empresas` y `POST /auth/empresa-activa` (cambia `sesiones.empresa_id`).
- **Reglas:** token de invitación de 32 bytes, guardado como hash, vigencia
  7 días, un solo uso. Una empresa siempre conserva al menos un `dueno`
  activo. Solo un `dueno` puede otorgar o quitar el rol `dueno`. Nadie cambia
  su propio rol ni se elimina a sí mismo. Desactivar o eliminar un miembro
  revoca sus sesiones en esa empresa. Invitar un correo que ya es miembro → 409.
  El correo de invitación se envía con `Mailer` (texto y HTML simples; las
  plantillas definitivas llegan en T34).
- **Pruebas:** cada regla anterior; token vencido, usado e inexistente;
  aceptación con cuenta nueva y con cuenta existente.

#### T13 — API de verificación de correo y recuperación de contraseña

- **Archivos:** `apps/api/src/cuenta/**`, `apps/api/test/cuenta.int-spec.ts`.
- **Endpoints:** `POST /auth/verificar-correo/enviar` (con sesión);
  `POST /publico/verificar-correo` (token); `POST /publico/recuperar` (correo);
  `POST /publico/restablecer` (token y contraseña nueva);
  `POST /auth/cambiar-contrasena` (actual y nueva).
- **Reglas:** tabla `tokens_verificacion`; tokens como hash, un solo uso;
  vigencia 24 h para verificar y 1 h para recuperar. `recuperar` responde
  siempre 204, exista o no el correo. Restablecer o cambiar la contraseña
  revoca **todas** las sesiones del usuario (salvo la actual al cambiarla) e
  invalida los demás tokens de recuperación. Pedir un token nuevo invalida los
  anteriores del mismo tipo. `@Throttle` estricto en los endpoints públicos.
  Tras el registro (T10) se envía el correo de verificación: engancharlo sin
  modificar `auth/` más allá de una llamada a un servicio exportado.
- **Pruebas:** cada regla; que el token no quede en claro en la base ni en los logs.

#### T14 — Web: estructura del panel

- **Archivos:** `apps/web/app/(panel)/**`, `apps/web/components/panel/**`,
  `apps/web/proxy.ts` (o `middleware.ts`, según la versión de Next instalada),
  pruebas y `e2e/panel.spec.ts`.
- **Qué:** layout con navegación lateral (colapsable; en móvil, `Sheet`),
  cabecera con menú de usuario (nombre, empresa, cambiar tema, cerrar sesión),
  navegación filtrada por rol, y página de inicio del panel con accesos.
- **Protección:** el layout del panel obtiene la sesión en el servidor con
  `apiServidor` y redirige a `/ingresar?siguiente=<ruta>` si no hay. El
  proxy/middleware solo hace la redirección rápida por ausencia de cookie; la
  autoridad es la API. Proveedor de sesión para los componentes cliente.
- **Pruebas:** navegación por rol; redirección sin sesión; cierre de sesión
  limpia la caché y vuelve a `/ingresar`.

### Oleada F1-O3 (T15, T16)

**Base común:** contrato `empresa.ts` (usar `zonaHorariaSchema`, `slugSchema`).

#### T15 — Configuración de la empresa (API y web)

- **Archivos:** `apps/api/src/empresa/**`, `apps/api/test/empresa.int-spec.ts`,
  `apps/web/app/(panel)/panel/configuracion/**`, `apps/web/components/configuracion/**`,
  `apps/web/hooks/use-empresa.ts`.
- **Endpoints:** `GET /empresa`; `PATCH /empresa` (perfil, zona horaria y las
  seis políticas de reserva de la tabla `empresas`).
- **Reglas:** cambiar el `slug` exige confirmación explícita en la web (rompe
  los enlaces públicos existentes). Rangos de las políticas según los `CHECK`
  de la tabla. Todo cambio queda para auditoría (la tabla se usa desde T38;
  aquí basta con no impedirlo).
- **Pruebas:** validación de cada política; slug duplicado y reservado; solo `dueno` y `admin` escriben.

#### T16 — Web: equipo, invitaciones, recuperación y verificación

- **Archivos:** `apps/web/app/(panel)/panel/equipo/**`,
  `apps/web/app/(auth)/{recuperar,restablecer,verificar,invitacion}/**`,
  `apps/web/components/equipo/**`, `apps/web/components/auth/**` (solo archivos nuevos),
  hooks correspondientes.
- **Qué:** tabla de miembros con cambio de rol y baja; invitar por correo;
  lista de invitaciones pendientes con revocación; pantallas públicas de
  aceptar invitación, pedir recuperación, restablecer contraseña y verificar
  correo; aviso en el panel si el correo no está verificado; selector de
  empresa en el menú de usuario cuando la persona pertenece a más de una.
- **Pruebas:** componentes de cada formulario; E2E de carga y validación.

---

## Fase 2 — Catálogo y disponibilidad

### Oleada F2-O1 (T17, T18)

**Base común:** contratos `servicios.ts` y `profesionales.ts`; fábricas de
prueba que falten; utilidad de paginación por cursor en
`apps/api/src/common/paginacion.ts` (codificar y decodificar el cursor,
aplicar `limite + 1` para saber si hay más).

#### T17 — API de servicios

- **Archivos:** `apps/api/src/servicios/**`, `apps/api/test/servicios.int-spec.ts`.
- **Endpoints:** `GET /servicios` (paginado; filtros `activo`, `categoria`,
  `q`); `GET /servicios/:id`; `POST`; `PATCH /servicios/:id`; `DELETE /servicios/:id`.
- **Reglas:** nombre único por empresa entre los activos (validado en la API).
  Eliminar un servicio con reservas no es posible (`RESTRICT`): responder 409
  indicando que se desactive. `color` con formato `#RRGGBB`.
- **Pruebas:** CRUD, filtros, paginación estable, 409 al eliminar con reservas.

#### T18 — API de profesionales y asignación de servicios

- **Archivos:** `apps/api/src/profesionales/**`, `apps/api/test/profesionales.int-spec.ts`.
- **Endpoints:** CRUD de `/profesionales` (paginado; filtros `activo`,
  `servicioId`, `q`); `PUT /profesionales/:id/servicios` (reemplaza la lista);
  `PUT /profesionales/:id/usuario` (vincula o desvincula un miembro).
- **Reglas:** los servicios asignados y el miembro vinculado deben ser de la
  misma empresa (404 si no). Un usuario se vincula a lo sumo a un profesional
  por empresa. Eliminar con reservas → 409, igual que T17.
- **Pruebas:** asignación atómica (transacción); identificadores de otra empresa.

### Oleada F2-O2 (T19, T20, T21)

**Base común:** contrato `disponibilidad.ts` (horarios y bloqueos); rutas del panel.

#### T19 — API de horarios semanales y bloqueos

- **Archivos:** `apps/api/src/horarios/**`, `apps/api/src/bloqueos/**`, pruebas de integración de ambos.
- **Endpoints:** `GET|PUT /profesionales/:id/horarios` (el `PUT` reemplaza la
  semana completa en una transacción); `GET /bloqueos?desde&hasta&profesionalId`;
  `POST /bloqueos`; `PATCH|DELETE /bloqueos/:id`.
- **Reglas:** los tramos de un mismo día no se solapan y `horaInicio < horaFin`.
  Un bloqueo con `profesionalId` nulo aplica a toda la empresa y solo lo crean
  `dueno` y `admin`. Un `profesional` solo gestiona sus propios horarios y
  bloqueos. Crear un bloqueo que cubra reservas activas se permite, pero la
  respuesta incluye cuántas reservas quedan afectadas.
- **Pruebas:** solapamientos; permisos del rol `profesional`; conteo de afectadas.

#### T20 — Web: servicios

- **Archivos:** `apps/web/app/(panel)/panel/servicios/**`, `apps/web/components/servicios/**`, `apps/web/hooks/use-servicios.ts`.
- **Qué:** tabla con búsqueda, filtro por estado y categoría, y paginación
  «cargar más»; alta y edición en diálogo; activar y desactivar; selector de
  color; precio y duración con `lib/formato.ts`; estados de carga, error y vacío.
- **Pruebas:** formulario, tabla y manejo de errores del servidor.

#### T21 — Web: profesionales

- **Archivos:** `apps/web/app/(panel)/panel/equipo/profesionales/**` (o la ruta
  que fije el preparador), `apps/web/components/profesionales/**`, `apps/web/hooks/use-profesionales.ts`.
- **Qué:** lista, alta y edición; asignación de servicios con selección
  múltiple; vínculo con un miembro del equipo; activar y desactivar.
- **Pruebas:** igual que T20.

### Oleada F2-O3 (T22, T23)

**Base común:** contrato de la consulta de horas libres en `disponibilidad.ts`.

#### T22 — Motor de disponibilidad y endpoint de horas libres

- **Archivos:** `apps/api/src/disponibilidad/**` y sus pruebas.
- **Núcleo:** una **función pura** `calcularHorasLibres(entrada)` sin acceso a
  la base ni al reloj (recibe `ahora`), probada de forma exhaustiva. Un
  servicio aparte reúne los datos y la invoca.
- **Entrada:** zona horaria y políticas de la empresa, servicio (duración y
  margen posterior), rango de fechas locales, tramos semanales del
  profesional, bloqueos (propios y de empresa) y reservas no canceladas.
- **Reglas:** las horas de inicio se ofrecen cada `intervaloGrillaMinutos`,
  alineadas al inicio de cada tramo. La atención completa
  (`duracion`) cabe en el tramo; el margen posterior puede exceder el tramo
  pero no chocar con otra reserva. Nada antes de `ahora + anticipacionMinima`
  ni después de `ahora + anticipacionMaximaDias`. Los tramos se interpretan en
  hora local: en un cambio de hora, las horas inexistentes se omiten y las
  repetidas se ofrecen una sola vez. El resultado son instantes UTC.
- **Endpoint:** `GET /disponibilidad?servicioId&profesionalId?&desde&hasta`
  (máximo 31 días). Sin `profesionalId` devuelve la unión de los profesionales
  que atienden el servicio, indicando cuáles están libres en cada hora.
- **Pruebas:** tabla de casos (tramo partido, bloqueo parcial, reservas
  contiguas, margen posterior, anticipaciones, fin de día, ambos cambios de
  hora de `America/Santiago`, zona distinta a la del servidor) y una prueba de
  integración del endpoint.

#### T23 — Web: horarios y bloqueos

- **Archivos:** `apps/web/app/(panel)/panel/equipo/horarios/**` (o la ruta que
  fije el preparador), `apps/web/components/disponibilidad/**`, hooks.
- **Qué:** editor semanal por profesional (varios tramos por día, copiar un
  día a otros); lista y alta de bloqueos con rango de fecha y hora en la zona
  de la empresa; aviso de reservas afectadas.
- **Pruebas:** validación de solapamientos en el cliente; conversión de zona al enviar.

---

## Fase 3 — Reservas y agenda

### Oleada F3-O1 (T24, T25)

**Base común:** contratos `clientes.ts` y `reservas.ts`.

#### T24 — API de clientes

- **Archivos:** `apps/api/src/clientes/**`, `apps/api/test/clientes.int-spec.ts`.
- **Endpoints:** `GET /clientes` (paginado, `q` por nombre, correo o
  teléfono); `GET /clientes/:id` (con conteo de reservas e inasistencias);
  `POST`; `PATCH`; `DELETE` (409 si tiene reservas);
  `GET /clientes/:id/reservas` (paginado).
- **Reglas:** correo único por empresa. Exportar un servicio
  `buscarOCrear(tx, empresaId, datos)` que usará T25 y T29 dentro de su transacción.
- **Pruebas:** unicidad, búsqueda, `buscarOCrear` concurrente.

#### T25 — API de reservas

- **Archivos:** `apps/api/src/reservas/**`, `apps/api/test/reservas.int-spec.ts`.
- **Endpoints:** `GET /reservas?desde&hasta&profesionalId&estado&clienteId`
  (rango máximo 62 días); `GET /reservas/:id`; `POST /reservas`;
  `PATCH /reservas/:id` (notas); `POST /reservas/:id/reagendar`;
  `POST /reservas/:id/{confirmar,cancelar,completar,no-asistio}`.
- **Reglas:** al crear o reagendar, dentro de una transacción: validar que el
  profesional atiende el servicio, que ambos están activos y son de la
  empresa, y que la hora está libre según T22 (el panel puede saltarse la
  anticipación mínima, no los tramos ni los bloqueos, salvo con el indicador
  `forzar` reservado a `dueno` y `admin`). Copiar `precio` y `duracionMinutos`
  del servicio y calcular `bloqueoHasta`. La restricción `reservas_sin_solape`
  es la garantía final: su error se devuelve como `RESERVA_SOLAPADA`.
  Transiciones según `TRANSICIONES_RESERVA`. `completar` y `no-asistio` solo
  después de la hora de inicio. Reagendar conserva la reserva (mismo id).
  Emitir un evento de dominio en cada cambio (`EventEmitter` de Nest; el
  preparador instala `@nestjs/event-emitter`) para que T35 y T38 se suscriban.
- **Pruebas:** cada regla; dos creaciones simultáneas de la misma hora (una
  sola prospera); cada transición válida e inválida; el rol `profesional`
  solo ve y modifica lo suyo.

### Oleada F3-O2 (T26, T27)

#### T26 — Web: calendario día y semana

- **Archivos:** `apps/web/app/(panel)/panel/agenda/**`, `apps/web/components/agenda/**`, `apps/web/hooks/use-reservas.ts`.
- **Qué:** grilla propia sobre CSS Grid (ADR 0002 §9). Vista día con una
  columna por profesional y vista semana para un profesional. Franjas según
  `intervaloGrillaMinutos`; tramos fuera de horario y bloqueos sombreados;
  línea de la hora actual; bloques de reserva con el color del servicio y
  estilo según el estado; navegación por fecha y «hoy»; filtro de
  profesionales; todo en la zona de la empresa. En móvil, un profesional a la
  vez. Sin arrastrar y soltar en esta tarea.
- **Rendimiento:** la posición de cada bloque se calcula con una función pura
  probada; `staleTime` corto y refresco al volver a la pestaña.
- **Pruebas:** la función de posicionamiento (incluidos solapes visuales de
  reservas canceladas y días con cambio de hora); render con datos simulados.

#### T27 — Web: clientes

- **Archivos:** `apps/web/app/(panel)/panel/clientes/**`, `apps/web/components/clientes/**`, `apps/web/hooks/use-clientes.ts`.
- **Qué:** lista con búsqueda y paginación; ficha con datos, notas internas,
  indicadores (reservas, inasistencias) e historial; alta y edición.
- **Pruebas:** formulario, búsqueda con retardo (debounce), ficha.

### Oleada F3-O3 (T28)

#### T28 — Web: crear y editar reservas desde el calendario

- **Archivos:** `apps/web/components/reservas/**`, cambios acotados en
  `components/agenda/**` para abrir el panel lateral.
- **Qué:** al pulsar una franja libre se abre un `Sheet` con servicio,
  profesional, fecha y hora (horas libres de T22), cliente (buscador con alta
  rápida) y notas. Al pulsar una reserva: detalle y acciones según el estado
  (confirmar, reagendar, cancelar con motivo, completar, no asistió).
  `RESERVA_SOLAPADA` → mensaje claro y recarga de horas libres. Tras cada
  cambio se invalidan las consultas de la agenda.
- **Pruebas:** flujo de creación, manejo del conflicto, acciones por estado; E2E del flujo completo con la API.

---

## Fase 4 — Reserva pública

### Oleada F4-O1 (T29)

**Base común:** contrato `publico.ts` (solo los campos que puede ver cualquiera).

#### T29 — API pública

- **Archivos:** `apps/api/src/publico/**`, `apps/api/test/publico.int-spec.ts`.
- **Endpoints** (todos `@Publico()` y con `@Throttle` estricto):
  `GET /publico/empresas/:slug` (perfil, políticas necesarias, servicios
  visibles y profesionales que los atienden);
  `GET /publico/empresas/:slug/disponibilidad`;
  `POST /publico/empresas/:slug/reservas`;
  `GET /publico/reservas/:token`; `POST /publico/reservas/:token/cancelar`;
  `POST /publico/reservas/:token/reagendar`.
- **Reglas:** solo servicios `visiblePublico` y activos; empresa inactiva → 404.
  Estado inicial según `confirmacionAutomatica`. Se respetan todas las
  políticas (sin `forzar`). «Cualquier profesional» asigna el que esté libre,
  con un criterio determinista. Token de gestión de 32 bytes guardado como
  hash; se entrega una sola vez en la respuesta de creación y viaja en el
  correo. Cancelar y reagendar solo hasta `cancelacionMinimaMinutos` antes.
  Las respuestas nunca incluyen notas internas, datos de otros clientes ni
  identificadores innecesarios. Campo trampa (honeypot) contra envíos automáticos.
- **Pruebas:** cada regla; que no se filtre ningún campo interno; límite de peticiones.

### Oleada F4-O2 (T30, T31)

#### T30 — Web: página pública y flujo de reserva

- **Archivos:** `apps/web/app/(publico)/[slug]/**`, `apps/web/components/publico/**`, hooks.
- **Qué:** página de la empresa renderizada en el servidor (`apiServidor` con
  `revalidarSegundos`), 404 real si no existe. Flujo en pasos: servicio →
  profesional (o «cualquiera») → día y hora → datos → confirmación. Pensado
  primero para móvil; estado del flujo en la URL para poder volver atrás;
  horas en la zona de la empresa, indicándola; pantalla final con resumen y
  enlace de gestión.
- **Pruebas:** cada paso; hora que se ocupa mientras se completa el formulario; E2E en el proyecto `movil`.

#### T31 — Web: gestionar la reserva por enlace

- **Archivos:** `apps/web/app/(publico)/reserva/[token]/**`, `apps/web/components/publico/gestion/**`.
- **Qué:** detalle de la reserva; cancelar con confirmación; reagendar
  reutilizando el selector de día y hora (coordinar con T30 a través de un
  componente que el preparador ubique como base común); mensajes claros
  cuando el plazo venció o el enlace no es válido. Página con `noindex`.
- **Pruebas:** cada estado de la reserva; plazo vencido.

### Oleada F4-O3 (T32)

#### T32 — SEO de las páginas públicas

- **Archivos:** `apps/web/app/(publico)/[slug]/{opengraph-image,metadata}*`,
  `apps/web/app/sitemap.ts`, `apps/web/app/robots.ts`, `generateMetadata` de la página pública.
- **Qué:** título y descripción por empresa, Open Graph, datos estructurados
  `LocalBusiness` (JSON-LD), `sitemap.xml` con las empresas activas, `robots.txt`
  que excluya `/panel`, `/api` y `/reserva`. URL canónica.
- **Pruebas:** metadatos generados; E2E que lea las etiquetas.

---

## Fase 5 — Notificaciones

**Decisión pendiente del usuario:** proveedor SMTP de producción. No bloquea:
todo se desarrolla contra Mailpit.

### Oleada F5-O1 (T33, T34)

**Base común:** instalar `bullmq` y `@nestjs/bullmq`; contrato
`notificaciones.ts`; interfaz `NotificationChannel` en `apps/api/src/notificaciones/canal.ts`.

#### T33 — Colas y canal de correo

- **Archivos:** `apps/api/src/colas/**`, `apps/api/src/notificaciones/**` (salvo plantillas), `apps/api/src/worker.ts`, pruebas.
- **Qué:** conexión a Redis (`REDIS_URL`); cola `notificaciones` con reintentos
  y espera exponencial; procesador que envía por el canal y actualiza la tabla
  `notificaciones` (estado, intentos, error). Proceso trabajador separado
  (`node dist/worker.js`) y script `dev:worker`. Trabajos idempotentes: el id
  del trabajo deriva de la notificación. Redis en `HealthService`.
- **Pruebas:** integración con Redis en Testcontainers; reintento tras fallo; no duplica envíos.

#### T34 — Plantillas de correo y archivo `.ics`

- **Archivos:** `apps/api/src/notificaciones/plantillas/**` y pruebas.
- **Qué:** funciones puras que devuelven `{ asunto, html, texto }` para:
  reserva recibida, confirmada, cancelada, reagendada, recordatorio,
  invitación, verificación de correo y recuperación de contraseña. HTML de
  correo compatible (tablas, estilos en línea), con versión de texto.
  Escapado de todo dato del usuario. Fechas en la zona de la empresa.
  Generador de `.ics` (RFC 5545) con `UID` estable por reserva, para que una
  reagenda actualice el evento en el calendario del cliente.
- **Pruebas:** instantáneas de cada plantilla; escapado; validez del `.ics`.

### Oleada F5-O2 (T35)

#### T35 — Envío por eventos y recordatorios

- **Archivos:** `apps/api/src/notificaciones/{disparadores,recordatorios}/**` y pruebas.
- **Qué:** suscribirse a los eventos de reservas (T25) y de cuenta (T12, T13)
  para crear la notificación y encolarla. Recordatorio como trabajo diferido a
  `inicio − recordatorioHorasAntes`; al reagendar se reprograma y al cancelar
  se elimina. Reemplazar los correos provisionales de T12 y T13 por las plantillas.
- **Reglas:** un fallo al encolar no revierte la reserva (se registra y se
  reintenta). El recordatorio no se envía si la reserva ya no está activa.
- **Pruebas:** cada evento genera su notificación; reprogramación y cancelación del recordatorio.

### Oleada F5-O3 (T36)

#### T36 — Web: registro de notificaciones

- **Archivos:** `apps/api/src/notificaciones/notificaciones.controller.ts`,
  `apps/web/app/(panel)/panel/notificaciones/**`, componentes y hooks.
- **Qué:** `GET /notificaciones` (paginado, filtros) y
  `POST /notificaciones/:id/reenviar`; pantalla con estado, destinatario,
  plantilla, fecha y error; reenvío de las fallidas; historial en el detalle de la reserva.

---

## Fase 6 — Gestión

### Oleada F6-O1 (T37, T38)

**Base común:** contratos `indicadores.ts` y `auditoria.ts`.

#### T37 — API de indicadores

- **Archivos:** `apps/api/src/indicadores/**` y pruebas.
- **Endpoint:** `GET /indicadores?desde&hasta` → reservas por estado, ingresos
  (suma de `precio` de las completadas), tasa de inasistencia, ocupación
  (minutos reservados sobre minutos de atención disponibles), y desgloses por
  servicio, por profesional y por día.
- **Reglas:** los días se cortan en la zona de la empresa. Consultas
  agregadas en SQL, no en memoria. Rango máximo de un año.
- **Pruebas:** datos conocidos con resultados calculados a mano; límite de día en la zona local.

#### T38 — Bitácora de auditoría

- **Archivos:** `apps/api/src/auditoria/**` y pruebas.
- **Qué:** servicio `registrar(tx?, { empresaId, actorId, accion, entidad, entidadId, antes, despues, ip })`
  y suscripción a los eventos de dominio para registrar cambios en reservas,
  servicios, profesionales, miembros y configuración. `GET /auditoria`
  (paginado, filtros por entidad, actor y fecha).
- **Reglas:** `antes` y `despues` nunca incluyen secretos ni hashes. Solo inserciones.

### Oleada F6-O2 (T39, T40)

#### T39 — Web: panel de indicadores

- **Archivos:** `apps/web/app/(panel)/panel/(inicio|indicadores)/**`, `apps/web/components/indicadores/**`.
- **Qué:** tarjetas con las cifras principales, selector de período y
  gráficos (el preparador instala `recharts` y el componente `chart` de
  shadcn). Colores desde los tokens `--chart-*`. Cada gráfico con una tabla
  equivalente accesible.

#### T40 — Exportación CSV y vista de auditoría

- **Archivos:** `apps/api/src/exportaciones/**`, `apps/web/app/(panel)/panel/auditoria/**`, componentes.
- **Qué:** `GET /exportaciones/reservas.csv` y `/clientes.csv` en streaming,
  con BOM UTF-8 y separador `;` (Excel en español); neutralizar fórmulas
  (celdas que empiezan con `=`, `+`, `-`, `@`); pantalla de auditoría con
  filtros y detalle de antes y después.

---

## Fase 7 — Endurecimiento y despliegue

**Decisión pendiente del usuario:** destino de despliegue. T45 no empieza sin ella.

### Oleada F7-O1 (T41, T42, T43)

#### T41 — Seguridad a nivel de fila (RLS)

- **Archivos:** migración manual nueva, `apps/api/src/db/**`, pruebas.
- **Qué:** políticas RLS por `empresa_id` en todas las tablas de negocio; rol
  de base de datos de la aplicación sin `BYPASSRLS`; la empresa se fija por
  transacción con `set_config('app.empresa_id', …, true)` mediante un
  ayudante `conEmpresa(db, empresaId, fn)`. Las rutas públicas y de
  autenticación usan un camino explícito y acotado. Es una segunda barrera:
  los filtros de la aplicación se mantienen.
- **Riesgo alto:** tarea crítica; requiere un plan escrito en la propia tarea
  antes de implementar y revisión reforzada.
- **Pruebas:** una consulta sin filtro de empresa no devuelve filas ajenas.

#### T42 — Pruebas E2E de los flujos críticos

- **Archivos:** `apps/web/e2e/**`, `apps/web/playwright.config.ts`, script de arranque de la pila de pruebas.
- **Qué:** `webServer` levanta API y web contra una base de pruebas con seed.
  Flujos: registro e ingreso; alta de servicio, profesional y horario; reserva
  desde el panel; reserva pública en móvil; cancelación por enlace; aislamiento
  entre dos empresas. Job de CI actualizado.

#### T43 — Accesibilidad y diseño adaptable

- **Archivos:** los que señale la auditoría (lista cerrada por el preparador).
- **Qué:** auditoría con `@axe-core/playwright` en cada pantalla, en ambos
  temas; corrección de contraste, foco, etiquetas y orden de tabulación;
  revisión en 375, 768 y 1280 px. Sin violaciones graves o críticas.

### Oleada F7-O2 (T44, T45)

#### T44 — Observabilidad

- **Archivos:** `apps/api/src/health/**`, `apps/api/src/observabilidad/**`, `apps/web/next.config.ts` (CSP).
- **Qué:** `/health/live` y `/health/ready` separados; métricas en formato
  Prometheus protegidas; reporte de errores a un servicio externo opcional por
  variable de entorno; política de contenido (CSP) con `nonce` en la web;
  tiempo máximo en el chequeo de la base.

#### T45 — Despliegue

- **Archivos:** `docker-compose.prod.yml`, `docs/OPERACION.md`, flujo de CI de imágenes.
- **Qué:** composición de producción (API, trabajador, web, PostgreSQL, Redis,
  proxy inverso con TLS), con secretos por variables; el CI construye y publica
  las imágenes; acciones fijadas por SHA; guía de operación (variables,
  migraciones, copias de seguridad y restauración, rotación de secretos,
  `TRUST_PROXY` según la topología).

---

## Fase 8 — Posterior

WhatsApp (segunda implementación de `NotificationChannel`) y pagos en línea
(`PaymentProvider`). Sin tareas definidas hasta cerrar la Fase 7 y elegir proveedores.
