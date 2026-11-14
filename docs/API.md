# Convenciones de la API

Reglas que cumple todo endpoint. La referencia interactiva de cada endpoint se
genera sola en `http://localhost:4000/api/docs` (fuera de producción).

## Rutas

- Prefijo y versión: `/api/v1/...`. La versión por defecto es `1`; para
  publicar otra: `@Controller({ path: 'reservas', version: '2' })`.
- Recursos en plural, en español y en minúsculas con guiones: `/servicios`,
  `/profesionales/:id/horarios`.
- Verbos: `GET` lee, `POST` crea, `PATCH` modifica parcialmente, `DELETE`
  elimina. Las acciones que no son CRUD se modelan como subrecurso con verbo:
  `POST /reservas/:id/cancelar`.
- Las rutas del panel no llevan la empresa en la URL: sale de la sesión.
- Las rutas sin sesión para la página pública van bajo `/publico/...` e
  identifican a la empresa por `slug`.

## Entradas

- Cuerpo, consulta y parámetros se validan con esquemas Zod de
  `@portfolio/contracts`, mediante DTO creados con `createZodDto`
  (`src/common/zod`). El controlador recibe los datos ya validados y
  transformados.
- Identificadores: UUID. Instantes: ISO 8601 con zona (`2026-11-13T15:00:00Z`).
  Fechas sin hora: `AAAA-MM-DD`. Horas locales: `HH:mm`. Dinero: entero.
- Las propiedades usan camelCase en español (`duracionMinutos`).

```ts
// servicios.dto.ts
export class CrearServicioDto extends createZodDto(crearServicioSchema) {}

// servicios.controller.ts
@Post()
@ApiZodBody(crearServicioSchema)
@ApiZodResponse(servicioSchema, { status: 201 })
@ApiErrores(400, 401, 403)
crear(@Body() datos: CrearServicioDto) {
  return this.servicios.crear(datos);
}
```

## Respuestas

- Éxito: el recurso directamente, sin envoltorio. `201` al crear, `204` sin
  cuerpo al eliminar, `200` en el resto.
- Listados: paginación por cursor, con la forma `{ datos, siguienteCursor }`
  (`paginaSchema` y `consultaPaginadaSchema` en contratos). Parámetros:
  `?cursor=...&limite=20` (máximo 100).
- Nunca se devuelven `passwordHash`, `tokenHash` ni otros secretos: los
  servicios seleccionan columnas explícitas o mapean a un esquema de salida.

## Errores

Toda respuesta 4xx o 5xx tiene esta forma (`errorApiSchema`):

```json
{
  "codigo": "VALIDACION",
  "mensaje": "Los datos enviados no son válidos",
  "detalles": [{ "campo": "nombre", "mensaje": "Requerido" }],
  "traceId": "4dbcea39-7150-475e-a0e9-9f72d28e4301"
}
```

| Código                   | HTTP | Cuándo                                                      |
| ------------------------ | ---- | ----------------------------------------------------------- |
| `VALIDACION`             | 400  | La entrada no cumple el esquema o una regla de formato      |
| `NO_AUTENTICADO`         | 401  | No hay sesión válida                                        |
| `SIN_PERMISO`            | 403  | El rol no permite la acción                                 |
| `NO_ENCONTRADO`          | 404  | El recurso no existe **o pertenece a otra empresa**         |
| `CONFLICTO`              | 409  | Choca con el estado actual (duplicado, transición inválida) |
| `RESERVA_SOLAPADA`       | 409  | El horario ya está tomado                                   |
| `DEMASIADAS_SOLICITUDES` | 429  | Se superó el límite de peticiones                           |
| `INTERNO`                | 500  | Fallo inesperado; el detalle queda solo en el registro      |

- Se lanzan con `AppException` (`src/common/errors/app.exception.ts`). El
  filtro global (`all-exceptions.filter.ts`) arma la respuesta.
- La web decide por `codigo`; `mensaje` es para mostrar y puede cambiar.
- Un código nuevo se agrega en `packages/contracts/src/errores.ts` y en la
  tabla `ESTADO_HTTP_POR_CODIGO`. Es un cambio de base común.
- `traceId` coincide con la cabecera `x-request-id` y con el campo `req.id`
  de los registros. Excepción: los errores que Express detecta antes de
  llegar a Nest (JSON mal formado, cuerpo demasiado grande) llevan el formato
  estándar pero pueden no tener `traceId`.
- Red de seguridad del filtro para errores de PostgreSQL: unicidad y clave
  foránea → 409; `CHECK` → 400; identificador con formato inválido → 404. No
  reemplaza la validación con Zod ni los mensajes específicos del servicio.

## Autenticación y empresa

Lo implementa la tarea T10; estas son las reglas que debe cumplir.

- Sesión por cookie `httpOnly` (nombre en `COOKIE_SESION`, `app.setup.ts`), `SameSite=Lax`, `Secure` en producción. El
  valor es un token aleatorio de 32 bytes; en la base de datos solo se guarda
  su hash SHA-256 (`sesiones.token_hash`).
- Toda ruta exige sesión salvo las marcadas con `@Publico()`.
- La empresa activa es `sesiones.empresa_id`. Los controladores la reciben
  con un decorador de parámetro; nunca la leen de la petición.
- Roles (`ROLES_MIEMBRO`): `dueno`, `admin`, `recepcion`, `profesional`. La
  autorización se declara por endpoint con `@Roles(...)`, listando **todos**
  los roles permitidos. No hay jerarquía implícita: `dueno` no incluye a
  `admin` salvo que el endpoint los nombre a ambos.
- Los endpoints que cambian estado verifican que la cabecera `Origin`
  coincida con `WEB_URL` (defensa adicional contra CSRF).

## Límite de peticiones

- Global: `THROTTLE_LIMITE` peticiones por IP cada `THROTTLE_TTL_SEGUNDOS`.
- Los endpoints sensibles lo endurecen con `@Throttle()`: inicio de sesión,
  registro, recuperación de contraseña y todo lo que esté bajo `/publico`.
- `GET /health` está exento.

## Fechas y zonas horarias

- La API recibe y devuelve instantes en UTC.
- Toda regla que dependa de la hora local (horarios de atención, «mañana»,
  anticipación mínima) se calcula con Luxon en la zona `empresas.zona_horaria`.
  Nunca con la zona del servidor ni con `new Date()` aritmético.

## Registro

- Registro estructurado con pino. De cada petición quedan método, ruta (sin
  cadena de consulta), estado y duración; nunca cabeceras ni cuerpos.
- Los errores de base de datos se registran saneados (`resumirParaRegistro`):
  código, restricción, tabla y columna, sin la consulta ni sus valores.
- En el código: `private readonly logger = new Logger(MiServicio.name)`.
- No se registran contraseñas, tokens, cookies ni datos personales.
