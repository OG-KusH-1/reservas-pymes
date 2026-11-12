import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * ==============================================================================
 * ESQUEMA DE BASE DE DATOS MULTIEMPRESA (Drizzle ORM + PostgreSQL 17)
 * ==============================================================================
 * Decisión de diseño:
 * Todas las entidades contienen explícitamente `empresa_id`.
 *
 * ¿Por qué?
 * 1. Aislamiento estricto: Permite filtrar por tenant en cualquier query sin
 *    hacer JOINs costosos a través de tablas intermedias.
 * 2. Preparación para Row-Level Security (RLS) en PostgreSQL: Permite activar
 *    políticas RLS nativas con facilidad si el sistema escala.
 * 3. Integridad y borrado en cascada: Garantiza que la eliminación o auditoría
 *    de una empresa aplique limpiamente sobre todas sus dependencias.
 */

// 1. EMPRESAS (Tenants o negocios registrados: peluquerías, talleres, etc.)
export const empresas = pgTable('empresas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  // El slug sirve para identificar a la empresa en URLs amigables (ej: reserva.app/mi-peluqueria)
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  rut: varchar('rut', { length: 20 }),
  email: varchar('email', { length: 255 }),
  telefono: varchar('telefono', { length: 50 }),
  activo: boolean('activo').default(true).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull(),
});

// 2. SERVICIOS (Catálogo de prestaciones ofrecidas por la empresa)
export const servicios = pgTable('servicios', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Obligatorio para garantizar pertenencia exclusiva al tenant
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  descripcion: text('descripcion'),
  // Duración en minutos: fundamental para calcular los bloques disponibles en la agenda
  duracionMinutos: integer('duracion_minutos').default(30).notNull(),
  // Precio expresado en enteros para evitar errores de redondeo en monedas locales
  precio: integer('precio').default(0).notNull(),
  activo: boolean('activo').default(true).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
});

// 3. PROFESIONALES (Prestadores de servicios dentro de la empresa)
export const profesionales = pgTable('profesionales', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id, { onDelete: 'cascade' }),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }),
  telefono: varchar('telefono', { length: 50 }),
  activo: boolean('activo').default(true).notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
});

// 4. HORARIOS (Disponibilidad semanal recurrente por profesional)
export const horarios = pgTable('horarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id, { onDelete: 'cascade' }),
  profesionalId: uuid('profesional_id')
    .notNull()
    .references(() => profesionales.id, { onDelete: 'cascade' }),
  // Día de la semana numérico (0 = Domingo, 1 = Lunes, ..., 6 = Sábado)
  diaSemana: integer('dia_semana').notNull(),
  // Formato HH:mm (ej: '09:00', '18:00') para granularidad horaria simple sin lidiar con timezones en la regla
  horaInicio: varchar('hora_inicio', { length: 5 }).notNull(),
  horaFin: varchar('hora_fin', { length: 5 }).notNull(),
  activo: boolean('activo').default(true).notNull(),
});

// 5. RESERVAS (Citas agendadas por clientes)
export const reservas = pgTable('reservas', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id, { onDelete: 'cascade' }),
  servicioId: uuid('servicio_id')
    .notNull()
    .references(() => servicios.id, { onDelete: 'restrict' }),
  profesionalId: uuid('profesional_id')
    .notNull()
    .references(() => profesionales.id, { onDelete: 'restrict' }),
  // Datos del cliente final (sin requerir autenticación obligatoria para facilitar agendamiento rápido)
  clienteNombre: varchar('cliente_nombre', { length: 255 }).notNull(),
  clienteEmail: varchar('cliente_email', { length: 255 }).notNull(),
  clienteTelefono: varchar('cliente_telefono', { length: 50 }).notNull(),
  // Timestamp con zona horaria para precisión cronológica absoluta
  fechaHoraInicio: timestamp('fecha_hora_inicio', { withTimezone: true }).notNull(),
  fechaHoraFin: timestamp('fecha_hora_fin', { withTimezone: true }).notNull(),
  // Estados del ciclo de vida: pendiente, confirmada, cancelada, completada
  estado: varchar('estado', { length: 50 }).default('pendiente').notNull(),
  notas: text('notas'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).defaultNow().notNull(),
});

// ==============================================================================
// DEFINICIÓN DE RELACIONES ORM PARA CONSULTAS RELACIONALES
// ==============================================================================

export const empresasRelations = relations(empresas, ({ many }) => ({
  servicios: many(servicios),
  profesionales: many(profesionales),
  horarios: many(horarios),
  reservas: many(reservas),
}));

export const serviciosRelations = relations(servicios, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [servicios.empresaId],
    references: [empresas.id],
  }),
  reservas: many(reservas),
}));

export const profesionalesRelations = relations(profesionales, ({ one, many }) => ({
  empresa: one(empresas, {
    fields: [profesionales.empresaId],
    references: [empresas.id],
  }),
  horarios: many(horarios),
  reservas: many(reservas),
}));

export const horariosRelations = relations(horarios, ({ one }) => ({
  empresa: one(empresas, {
    fields: [horarios.empresaId],
    references: [empresas.id],
  }),
  profesional: one(profesionales, {
    fields: [horarios.profesionalId],
    references: [profesionales.id],
  }),
}));

export const reservasRelations = relations(reservas, ({ one }) => ({
  empresa: one(empresas, {
    fields: [reservas.empresaId],
    references: [empresas.id],
  }),
  servicio: one(servicios, {
    fields: [reservas.servicioId],
    references: [servicios.id],
  }),
  profesional: one(profesionales, {
    fields: [reservas.profesionalId],
    references: [profesionales.id],
  }),
}));
