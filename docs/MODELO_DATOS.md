# Modelo de datos

La definición exacta (columnas, tipos, valores por defecto) está en
`apps/api/src/db/schema.ts`, que es la fuente de verdad y está comentada tabla
por tabla. Este documento explica el diseño y lo que el esquema no puede decir.

## Mapa

```
empresas ─┬─ miembros ── usuarios ─┬─ sesiones
          │                         └─ tokens_verificacion
          ├─ invitaciones
          ├─ servicios ──────┐
          ├─ profesionales ──┼─ profesionales_servicios
          │      ├─ horarios │
          │      └─ bloqueos │
          ├─ clientes ───────┤
          ├─ reservas ───────┘  (servicio + profesional + cliente)
          ├─ notificaciones     (opcionalmente ligadas a una reserva)
          └─ auditoria
```

| Tabla                     | Propósito                                           |
| ------------------------- | --------------------------------------------------- |
| `empresas`                | Tenant; incluye zona horaria y políticas de reserva |
| `usuarios`                | Cuentas del panel (globales)                        |
| `miembros`                | Usuario ↔ empresa, con rol                          |
| `sesiones`                | Sesiones activas; fijan la empresa de cada petición |
| `invitaciones`            | Invitaciones a sumarse a una empresa                |
| `tokens_verificacion`     | Verificación de correo y recuperación de contraseña |
| `servicios`               | Catálogo                                            |
| `profesionales`           | Quienes atienden                                    |
| `profesionales_servicios` | Qué servicios atiende cada profesional              |
| `horarios`                | Tramos semanales de atención                        |
| `bloqueos`                | Excepciones: vacaciones, feriados, colación         |
| `clientes`                | Clientes finales de cada empresa                    |
| `reservas`                | Citas                                               |
| `notificaciones`          | Registro de correos enviados o programados          |
| `auditoria`               | Bitácora de acciones                                |

## Reglas de diseño

1. **Multiempresa.** Toda tabla de negocio tiene `empresa_id` con índice.
   Las consultas filtran siempre por la empresa de la sesión. Excepciones:
   `usuarios` y `tokens_verificacion`, que son globales.
2. **Borrado.** Eliminar una empresa arrastra todo lo suyo (`CASCADE`), salvo
   que tenga reservas: estas referencian servicio, profesional y cliente con
   `RESTRICT`, de modo que el historial nunca queda huérfano. Para retirar un
   servicio o un profesional con historial se usa `activo = false`.
3. **Tiempo.** Instantes en `timestamptz` (UTC). `horarios` usa `time` porque
   son horas locales de la empresa.
4. **Dinero.** Enteros en la unidad mínima de la moneda.
5. **Secretos.** Solo hashes: Argon2id para contraseñas, SHA-256 para tokens.
6. **Índices.** Además de `empresa_id`, tienen índice las claves foráneas por
   las que se consulta o que se recorren al borrar. No lo tienen, a propósito,
   las referencias a `usuarios` de solo registro (`reservas.creado_por_id`,
   `auditoria.actor_id`, `invitaciones.invitado_por_id`): borrar un usuario es
   excepcional y no justifica el costo de escritura de tres índices más.
7. **Enumeraciones.** Tipos `ENUM` de PostgreSQL creados desde las tuplas de
   `@portfolio/contracts`.

## Restricción antisolape de reservas

Es la pieza más importante del modelo. Vive en la migración manual
`apps/api/drizzle/0001_reservas_antisolape.sql`, porque Drizzle no modela
restricciones `EXCLUDE`, y por eso **no aparece en `schema.ts`**.

```sql
ALTER TABLE reservas ADD CONSTRAINT reservas_sin_solape
  EXCLUDE USING gist (
    profesional_id WITH =,
    tstzrange(fecha_hora_inicio, bloqueo_hasta, '[)') WITH &&
  ) WHERE (estado <> 'cancelada');
```

- Impide que dos reservas no canceladas del mismo profesional se crucen.
  PostgreSQL lo comprueba de forma atómica, así que dos peticiones simultáneas
  por la misma hora nunca prosperan ambas.
- El tramo ocupado es `[fecha_hora_inicio, bloqueo_hasta)`. `bloqueo_hasta` es
  el fin de la atención más el margen posterior del servicio. El rango es
  semiabierto: una reserva puede empezar justo cuando termina la anterior.
- Al violarla, PostgreSQL devuelve el error `23P01` y el filtro global
  responde `409 RESERVA_SOLAPADA`.
- La API debe validar igualmente la disponibilidad antes de insertar, para
  dar un mensaje claro; la restricción es la garantía final, no la única.
- Está cubierta por `apps/api/test/infraestructura.int-spec.ts`.

**Si agregas un estado de reserva que libere la hora**, hay que recrear la
restricción con una migración nueva que lo excluya en el `WHERE`.

## Reglas que valida la aplicación (no la base de datos)

La base de datos no puede expresarlas con una restricción simple; cada
servicio de la API es responsable de cumplirlas y probarlas:

- Las filas relacionadas pertenecen a la misma empresa (el servicio, el
  profesional y el cliente de una reserva; el profesional de un horario).
- Los tramos de `horarios` de un mismo profesional y día no se solapan.
- El profesional de una reserva atiende ese servicio (`profesionales_servicios`).
- La reserva cae dentro de un tramo de atención y fuera de todo bloqueo.
- Las transiciones de estado siguen `TRANSICIONES_RESERVA` (contratos).
- Los correos se guardan en minúsculas (los normaliza `correoSchema`).

La Fase 7 agrega seguridad a nivel de fila (RLS) como segunda barrera del
aislamiento entre empresas.

## Migraciones

```bash
pnpm db:generate   # crea la migración SQL a partir de los cambios en schema.ts
pnpm db:migrate    # aplica las migraciones pendientes
pnpm db:seed       # carga la empresa demo (agrega `-- --reset` para recrearla)
```

- Revisa siempre el SQL generado antes de aplicarlo.
- Nunca edites ni borres una migración ya aplicada: crea una nueva.
- Migración manual (SQL que Drizzle no genera):
  `pnpm --filter @portfolio/api exec drizzle-kit generate --custom --name=<nombre>`.
- No uses `drizzle-kit push`: no deja historial y omite las migraciones manuales.
- En producción las aplica el contenedor de la API al arrancar
  (`node dist/db/migrate.js`).
