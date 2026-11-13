-- Migración manual: restricción antisolape de reservas.
--
-- Drizzle no modela restricciones EXCLUDE, por eso este archivo se escribió a
-- mano (creado con `drizzle-kit generate --custom`). No aparece en
-- `src/db/schema.ts`; su documentación está en `docs/MODELO_DATOS.md`.
--
-- Qué garantiza: para un mismo profesional no pueden existir dos reservas no
-- canceladas cuyos tramos [fecha_hora_inicio, bloqueo_hasta) se crucen.
-- PostgreSQL lo comprueba de forma atómica al insertar o actualizar, de modo
-- que dos peticiones simultáneas por la misma hora nunca prosperan ambas: la
-- segunda falla con SQLSTATE 23P01 y la API responde RESERVA_SOLAPADA.
--
-- Detalles de diseño:
--  * El rango es semiabierto '[)': una reserva puede empezar exactamente
--    cuando termina la anterior.
--  * Se usa `bloqueo_hasta` (fin + margen posterior del servicio) y no
--    `fecha_hora_fin`, para respetar el tiempo de preparación entre atenciones.
--  * Las reservas canceladas quedan fuera (cláusula WHERE) y liberan la hora.
--  * `btree_gist` permite combinar la igualdad de `profesional_id` (uuid) con
--    el operador de solapamiento de rangos en un mismo índice GiST.
--
-- Si cambia el nombre de la restricción, actualiza también
-- RESTRICCION_ANTISOLAPE en `src/common/errors/all-exceptions.filter.ts`.

CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "reservas"
  ADD CONSTRAINT "reservas_sin_solape"
  EXCLUDE USING gist (
    "profesional_id" WITH =,
    tstzrange("fecha_hora_inicio", "bloqueo_hasta", '[)') WITH &&
  )
  WHERE ("estado" <> 'cancelada');
