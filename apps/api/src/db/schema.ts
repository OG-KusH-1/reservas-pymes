import {
  CANALES_NOTIFICACION,
  ESTADOS_NOTIFICACION,
  ESTADOS_RESERVA,
  ORIGENES_RESERVA,
  ROLES_MIEMBRO,
  TIPOS_TOKEN,
} from '@portfolio/contracts';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * ==============================================================================
 * ESQUEMA DE BASE DE DATOS (Drizzle ORM + PostgreSQL 17)
 * ==============================================================================
 *
 * Reglas del modelo. Respétalas al agregar o modificar tablas:
 *
 * 1. MULTIEMPRESA. Toda tabla de negocio lleva `empresa_id` con índice, incluso
 *    cuando podría deducirse por una relación. Permite filtrar por empresa sin
 *    JOIN y habilita la seguridad a nivel de fila (RLS) prevista para la Fase 7.
 *    Las únicas tablas sin `empresa_id` son las de identidad global
 *    (`usuarios`, `tokens_verificacion`): una persona puede pertenecer a
 *    varias empresas a través de `miembros`.
 *
 * 2. TIEMPO. Los instantes se guardan como `timestamptz` (UTC). La hora local
 *    se calcula con `empresas.zona_horaria`. Los horarios semanales usan `time`
 *    porque son horas locales «de pared», sin fecha.
 *
 * 3. DINERO. Enteros en la unidad mínima de la moneda (pesos en CLP).
 *
 * 4. SECRETOS. Nunca se guarda un token en claro: solo su hash SHA-256
 *    (`*_hash`). Las contraseñas se guardan con Argon2id.
 *
 * 5. ENUMERACIONES. Se crean a partir de las tuplas de `@portfolio/contracts`,
 *    de modo que la base de datos, la API y la web comparten los mismos valores.
 *
 * 6. MIGRACIONES. Tras cambiar este archivo ejecuta `pnpm db:generate` y revisa
 *    el SQL generado en `apps/api/drizzle/`. Nunca edites una migración ya
 *    aplicada: crea una nueva. La restricción antisolape de `reservas` vive en
 *    una migración manual porque Drizzle no modela `EXCLUDE` (ver
 *    `docs/MODELO_DATOS.md`).
 *
 * Los nombres de dominio están en español (tablas y columnas en snake_case,
 * propiedades de TypeScript en camelCase).
 */

// Columnas de auditoría temporal reutilizadas por casi todas las tablas.
const creadoEn = () => timestamp('creado_en', { withTimezone: true }).defaultNow().notNull();
const actualizadoEn = () =>
  timestamp('actualizado_en', { withTimezone: true })
    .defaultNow()
    .notNull()
    // Drizzle actualiza el valor en cada `update()` hecho a través del ORM.
    .$onUpdate(() => new Date());

/** Clave foránea obligatoria hacia la empresa dueña de la fila. */
const empresaId = () =>
  uuid('empresa_id')
    .notNull()
    .references(() => empresas.id, { onDelete: 'cascade' });

// ------------------------------------------------------------------------------
// ENUMERACIONES
// ------------------------------------------------------------------------------

export const rolMiembroEnum = pgEnum('rol_miembro', ROLES_MIEMBRO);
export const estadoReservaEnum = pgEnum('estado_reserva', ESTADOS_RESERVA);
export const origenReservaEnum = pgEnum('origen_reserva', ORIGENES_RESERVA);
export const canalNotificacionEnum = pgEnum('canal_notificacion', CANALES_NOTIFICACION);
export const estadoNotificacionEnum = pgEnum('estado_notificacion', ESTADOS_NOTIFICACION);
export const tipoTokenEnum = pgEnum('tipo_token', TIPOS_TOKEN);

// ------------------------------------------------------------------------------
// EMPRESA (tenant)
// ------------------------------------------------------------------------------

/**
 * Negocio que usa la plataforma. Es la raíz del aislamiento multiempresa.
 * Incluye las políticas de reserva porque son pocas, siempre se leen junto a
 * la empresa y no justifican una tabla aparte.
 */
export const empresas = pgTable(
  'empresas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    nombre: varchar('nombre', { length: 255 }).notNull(),
    /** Identificador en la URL pública (`/{slug}`). */
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    rut: varchar('rut', { length: 20 }),
    email: varchar('email', { length: 255 }),
    telefono: varchar('telefono', { length: 50 }),
    direccion: varchar('direccion', { length: 255 }),
    /** Zona horaria IANA; define la hora local de horarios y reservas. */
    zonaHoraria: varchar('zona_horaria', { length: 64 }).default('America/Santiago').notNull(),
    /** Código ISO 4217. */
    moneda: varchar('moneda', { length: 3 }).default('CLP').notNull(),

    // --- Políticas de reserva ---
    /** No se puede reservar con menos de estos minutos de anticipación. */
    anticipacionMinimaMinutos: integer('anticipacion_minima_minutos').default(60).notNull(),
    /** No se puede reservar a más de estos días en el futuro. */
    anticipacionMaximaDias: integer('anticipacion_maxima_dias').default(60).notNull(),
    /** El cliente puede cancelar o reagendar hasta estos minutos antes de la cita. */
    cancelacionMinimaMinutos: integer('cancelacion_minima_minutos').default(120).notNull(),
    /** Cada cuántos minutos se ofrece una hora de inicio (grilla de la agenda). */
    intervaloGrillaMinutos: integer('intervalo_grilla_minutos').default(15).notNull(),
    /** Si es `false`, las reservas públicas nacen `pendiente` y la empresa las confirma. */
    confirmacionAutomatica: boolean('confirmacion_automatica').default(true).notNull(),
    /** Horas antes de la cita en que se envía el recordatorio. 0 = sin recordatorio. */
    recordatorioHorasAntes: integer('recordatorio_horas_antes').default(24).notNull(),

    activo: boolean('activo').default(true).notNull(),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    check('empresas_anticipacion_minima_chk', sql`${t.anticipacionMinimaMinutos} >= 0`),
    check('empresas_anticipacion_maxima_chk', sql`${t.anticipacionMaximaDias} > 0`),
    check('empresas_cancelacion_minima_chk', sql`${t.cancelacionMinimaMinutos} >= 0`),
    check('empresas_intervalo_grilla_chk', sql`${t.intervaloGrillaMinutos} BETWEEN 5 AND 120`),
    check('empresas_recordatorio_chk', sql`${t.recordatorioHorasAntes} >= 0`),
  ],
);

// ------------------------------------------------------------------------------
// IDENTIDAD Y ACCESO
// ------------------------------------------------------------------------------

/** Cuenta de una persona que entra al panel. Es global: no pertenece a una empresa. */
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Siempre en minúsculas (lo normaliza `correoSchema`), por eso basta un índice único simple. */
  email: varchar('email', { length: 255 }).notNull().unique(),
  nombre: varchar('nombre', { length: 255 }).notNull(),
  /** Hash Argon2id. Nunca debe salir en una respuesta de la API. */
  passwordHash: text('password_hash').notNull(),
  emailVerificadoEn: timestamp('email_verificado_en', { withTimezone: true }),
  activo: boolean('activo').default(true).notNull(),
  creadoEn: creadoEn(),
  actualizadoEn: actualizadoEn(),
});

/** Pertenencia de un usuario a una empresa, con su rol. */
export const miembros = pgTable(
  'miembros',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    rol: rolMiembroEnum('rol').notNull(),
    activo: boolean('activo').default(true).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [
    uniqueIndex('miembros_empresa_usuario_uq').on(t.empresaId, t.usuarioId),
    index('miembros_usuario_idx').on(t.usuarioId),
  ],
);

/**
 * Sesión del panel. La cookie lleva un token aleatorio; aquí solo se guarda
 * su hash, de modo que una filtración de la base de datos no permite
 * suplantar sesiones. `empresa_id` es la empresa activa de la sesión: de ahí
 * sale el tenant de cada petición, nunca de un dato enviado por el cliente.
 */
export const sesiones = pgTable(
  'sesiones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    empresaId: empresaId(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    /** Cierre de sesión o revocación administrativa. */
    revocadaEn: timestamp('revocada_en', { withTimezone: true }),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    ultimoUsoEn: timestamp('ultimo_uso_en', { withTimezone: true }).defaultNow().notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('sesiones_usuario_idx').on(t.usuarioId),
    index('sesiones_empresa_idx').on(t.empresaId),
    index('sesiones_expira_idx').on(t.expiraEn),
  ],
);

/** Invitación por correo para sumarse a una empresa con un rol. */
export const invitaciones = pgTable(
  'invitaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    email: varchar('email', { length: 255 }).notNull(),
    rol: rolMiembroEnum('rol').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    invitadoPorId: uuid('invitado_por_id').references(() => usuarios.id, { onDelete: 'set null' }),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    aceptadaEn: timestamp('aceptada_en', { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index('invitaciones_empresa_idx').on(t.empresaId)],
);

/** Tokens de un solo uso enviados por correo (verificar correo, recuperar contraseña). */
export const tokensVerificacion = pgTable(
  'tokens_verificacion',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarios.id, { onDelete: 'cascade' }),
    tipo: tipoTokenEnum('tipo').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiraEn: timestamp('expira_en', { withTimezone: true }).notNull(),
    usadoEn: timestamp('usado_en', { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index('tokens_verificacion_usuario_idx').on(t.usuarioId)],
);

// ------------------------------------------------------------------------------
// CATÁLOGO
// ------------------------------------------------------------------------------

/** Prestación que ofrece la empresa. */
export const servicios = pgTable(
  'servicios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nombre: varchar('nombre', { length: 255 }).notNull(),
    descripcion: text('descripcion'),
    categoria: varchar('categoria', { length: 100 }),
    /** Tiempo de atención que ve el cliente. */
    duracionMinutos: integer('duracion_minutos').default(30).notNull(),
    /**
     * Tiempo extra que bloquea la agenda después de la atención (limpieza,
     * preparación). El cliente no lo ve, pero impide tomar la hora siguiente.
     */
    margenPosteriorMinutos: integer('margen_posterior_minutos').default(0).notNull(),
    precio: integer('precio').default(0).notNull(),
    /** Si es `false`, solo se puede agendar desde el panel. */
    visiblePublico: boolean('visible_publico').default(true).notNull(),
    /** Color `#RRGGBB` para distinguirlo en el calendario. */
    color: varchar('color', { length: 7 }),
    activo: boolean('activo').default(true).notNull(),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    index('servicios_empresa_idx').on(t.empresaId),
    check('servicios_duracion_chk', sql`${t.duracionMinutos} > 0`),
    check('servicios_margen_chk', sql`${t.margenPosteriorMinutos} >= 0`),
    check('servicios_precio_chk', sql`${t.precio} >= 0`),
  ],
);

/** Persona que atiende. Puede o no tener cuenta en el panel (`usuario_id`). */
export const profesionales = pgTable(
  'profesionales',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    /** Vínculo opcional a la cuenta con la que el profesional ve su propia agenda. */
    usuarioId: uuid('usuario_id').references(() => usuarios.id, { onDelete: 'set null' }),
    nombre: varchar('nombre', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    telefono: varchar('telefono', { length: 50 }),
    activo: boolean('activo').default(true).notNull(),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    index('profesionales_empresa_idx').on(t.empresaId),
    // Permite encontrar el profesional asociado a la cuenta que inició sesión.
    index('profesionales_usuario_idx').on(t.usuarioId),
  ],
);

/** Qué servicios atiende cada profesional (relación muchos a muchos). */
export const profesionalesServicios = pgTable(
  'profesionales_servicios',
  {
    empresaId: empresaId(),
    profesionalId: uuid('profesional_id')
      .notNull()
      .references(() => profesionales.id, { onDelete: 'cascade' }),
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicios.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.profesionalId, t.servicioId] }),
    index('profesionales_servicios_servicio_idx').on(t.servicioId),
    index('profesionales_servicios_empresa_idx').on(t.empresaId),
  ],
);

// ------------------------------------------------------------------------------
// DISPONIBILIDAD
// ------------------------------------------------------------------------------

/**
 * Tramo de atención semanal de un profesional, en hora local de la empresa.
 * Un día puede tener varios tramos (mañana y tarde, por ejemplo); el motor de
 * disponibilidad los une. Los tramos de un mismo día no deben solaparse: lo
 * valida la API al guardar.
 */
export const horarios = pgTable(
  'horarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    profesionalId: uuid('profesional_id')
      .notNull()
      .references(() => profesionales.id, { onDelete: 'cascade' }),
    /** 0 = domingo … 6 = sábado. */
    diaSemana: integer('dia_semana').notNull(),
    horaInicio: time('hora_inicio').notNull(),
    horaFin: time('hora_fin').notNull(),
    activo: boolean('activo').default(true).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('horarios_profesional_dia_idx').on(t.profesionalId, t.diaSemana),
    index('horarios_empresa_idx').on(t.empresaId),
    check('horarios_dia_semana_chk', sql`${t.diaSemana} BETWEEN 0 AND 6`),
    check('horarios_rango_chk', sql`${t.horaInicio} < ${t.horaFin}`),
  ],
);

/**
 * Excepción a la disponibilidad: vacaciones, feriados, colación, una reunión.
 * Con `profesional_id` nulo el bloqueo aplica a toda la empresa (un feriado).
 */
export const bloqueos = pgTable(
  'bloqueos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    profesionalId: uuid('profesional_id').references(() => profesionales.id, {
      onDelete: 'cascade',
    }),
    inicio: timestamp('inicio', { withTimezone: true }).notNull(),
    fin: timestamp('fin', { withTimezone: true }).notNull(),
    motivo: varchar('motivo', { length: 255 }),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('bloqueos_empresa_inicio_idx').on(t.empresaId, t.inicio),
    index('bloqueos_profesional_idx').on(t.profesionalId),
    check('bloqueos_rango_chk', sql`${t.inicio} < ${t.fin}`),
  ],
);

// ------------------------------------------------------------------------------
// CLIENTES Y RESERVAS
// ------------------------------------------------------------------------------

/**
 * Cliente final de una empresa. No tiene cuenta: se identifica por su correo
 * dentro de cada empresa. La misma persona en dos empresas son dos filas
 * distintas, porque cada empresa es dueña de sus propios datos de clientes.
 */
export const clientes = pgTable(
  'clientes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nombre: varchar('nombre', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    telefono: varchar('telefono', { length: 50 }),
    /** Notas internas de la empresa; el cliente nunca las ve. */
    notas: text('notas'),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [uniqueIndex('clientes_empresa_email_uq').on(t.empresaId, t.email)],
);

/**
 * Cita agendada.
 *
 * - `precio` y `duracion_minutos` se copian del servicio al reservar, para que
 *   un cambio posterior del catálogo no altere reservas ya tomadas.
 * - `bloqueo_hasta` = fin de la atención + margen posterior del servicio. Es
 *   el fin real del tramo ocupado en la agenda.
 * - ANTISOLAPE: la restricción `reservas_sin_solape` (migración manual) impide
 *   que dos reservas no canceladas del mismo profesional se crucen en
 *   `[fecha_hora_inicio, bloqueo_hasta)`. Es la garantía definitiva contra la
 *   doble reserva; la validación de la API solo mejora el mensaje de error.
 * - `token_gestion_hash` permite al cliente cancelar o reagendar desde el
 *   enlace de su correo, sin cuenta.
 */
export const reservas = pgTable(
  'reservas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    servicioId: uuid('servicio_id')
      .notNull()
      .references(() => servicios.id, { onDelete: 'restrict' }),
    profesionalId: uuid('profesional_id')
      .notNull()
      .references(() => profesionales.id, { onDelete: 'restrict' }),
    clienteId: uuid('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    fechaHoraInicio: timestamp('fecha_hora_inicio', { withTimezone: true }).notNull(),
    fechaHoraFin: timestamp('fecha_hora_fin', { withTimezone: true }).notNull(),
    bloqueoHasta: timestamp('bloqueo_hasta', { withTimezone: true }).notNull(),
    estado: estadoReservaEnum('estado').default('pendiente').notNull(),
    origen: origenReservaEnum('origen').notNull(),
    precio: integer('precio').notNull(),
    duracionMinutos: integer('duracion_minutos').notNull(),
    /** Comentario del cliente al reservar. */
    notas: text('notas'),
    /** Notas del equipo; no se muestran al cliente. */
    notasInternas: text('notas_internas'),
    tokenGestionHash: varchar('token_gestion_hash', { length: 64 }).unique(),
    canceladaEn: timestamp('cancelada_en', { withTimezone: true }),
    motivoCancelacion: varchar('motivo_cancelacion', { length: 255 }),
    /** Miembro del equipo que la creó; nulo si vino de la página pública. */
    creadoPorId: uuid('creado_por_id').references(() => usuarios.id, { onDelete: 'set null' }),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    index('reservas_empresa_inicio_idx').on(t.empresaId, t.fechaHoraInicio),
    index('reservas_profesional_inicio_idx').on(t.profesionalId, t.fechaHoraInicio),
    index('reservas_cliente_idx').on(t.clienteId),
    index('reservas_servicio_idx').on(t.servicioId),
    check('reservas_rango_chk', sql`${t.fechaHoraInicio} < ${t.fechaHoraFin}`),
    check('reservas_bloqueo_chk', sql`${t.bloqueoHasta} >= ${t.fechaHoraFin}`),
    check('reservas_precio_chk', sql`${t.precio} >= 0`),
    check('reservas_duracion_chk', sql`${t.duracionMinutos} > 0`),
  ],
);

// ------------------------------------------------------------------------------
// REGISTROS: NOTIFICACIONES Y AUDITORÍA
// ------------------------------------------------------------------------------

/** Historial de mensajes enviados o programados (confirmaciones, recordatorios). */
export const notificaciones = pgTable(
  'notificaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    reservaId: uuid('reserva_id').references(() => reservas.id, { onDelete: 'cascade' }),
    canal: canalNotificacionEnum('canal').notNull(),
    /** Identificador de la plantilla, por ejemplo `reserva_confirmada`. */
    plantilla: varchar('plantilla', { length: 50 }).notNull(),
    destinatario: varchar('destinatario', { length: 255 }).notNull(),
    estado: estadoNotificacionEnum('estado').default('pendiente').notNull(),
    intentos: integer('intentos').default(0).notNull(),
    /** Último error del proveedor, para diagnóstico. */
    error: text('error'),
    programadaPara: timestamp('programada_para', { withTimezone: true }),
    enviadaEn: timestamp('enviada_en', { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('notificaciones_empresa_creado_idx').on(t.empresaId, t.creadoEn),
    index('notificaciones_reserva_idx').on(t.reservaId),
    index('notificaciones_pendientes_idx').on(t.estado, t.programadaPara),
  ],
);

/**
 * Bitácora de acciones relevantes (quién hizo qué y cuándo). Solo se insertan
 * filas; nunca se actualizan ni se borran desde la aplicación.
 */
export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: empresaId(),
    /** Nulo cuando actúa el sistema o un cliente desde la página pública. */
    actorId: uuid('actor_id').references(() => usuarios.id, { onDelete: 'set null' }),
    /** Verbo en formato `entidad.accion`, por ejemplo `reserva.cancelar`. */
    accion: varchar('accion', { length: 100 }).notNull(),
    entidad: varchar('entidad', { length: 50 }).notNull(),
    entidadId: uuid('entidad_id'),
    antes: jsonb('antes'),
    despues: jsonb('despues'),
    ip: varchar('ip', { length: 45 }),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('auditoria_empresa_creado_idx').on(t.empresaId, t.creadoEn),
    index('auditoria_entidad_idx').on(t.entidad, t.entidadId),
  ],
);

// ==============================================================================
// RELACIONES (para la API de consultas relacionales `db.query.*`)
// No crean nada en la base de datos; solo describen cómo navegar entre tablas.
// ==============================================================================

export const empresasRelations = relations(empresas, ({ many }) => ({
  miembros: many(miembros),
  servicios: many(servicios),
  profesionales: many(profesionales),
  horarios: many(horarios),
  bloqueos: many(bloqueos),
  clientes: many(clientes),
  reservas: many(reservas),
}));

export const usuariosRelations = relations(usuarios, ({ many }) => ({
  miembros: many(miembros),
  sesiones: many(sesiones),
}));

export const miembrosRelations = relations(miembros, ({ one }) => ({
  empresa: one(empresas, { fields: [miembros.empresaId], references: [empresas.id] }),
  usuario: one(usuarios, { fields: [miembros.usuarioId], references: [usuarios.id] }),
}));

export const sesionesRelations = relations(sesiones, ({ one }) => ({
  usuario: one(usuarios, { fields: [sesiones.usuarioId], references: [usuarios.id] }),
  empresa: one(empresas, { fields: [sesiones.empresaId], references: [empresas.id] }),
}));

export const invitacionesRelations = relations(invitaciones, ({ one }) => ({
  empresa: one(empresas, { fields: [invitaciones.empresaId], references: [empresas.id] }),
  invitadoPor: one(usuarios, { fields: [invitaciones.invitadoPorId], references: [usuarios.id] }),
}));

export const tokensVerificacionRelations = relations(tokensVerificacion, ({ one }) => ({
  usuario: one(usuarios, { fields: [tokensVerificacion.usuarioId], references: [usuarios.id] }),
}));

export const serviciosRelations = relations(servicios, ({ one, many }) => ({
  empresa: one(empresas, { fields: [servicios.empresaId], references: [empresas.id] }),
  profesionales: many(profesionalesServicios),
  reservas: many(reservas),
}));

export const profesionalesRelations = relations(profesionales, ({ one, many }) => ({
  empresa: one(empresas, { fields: [profesionales.empresaId], references: [empresas.id] }),
  usuario: one(usuarios, { fields: [profesionales.usuarioId], references: [usuarios.id] }),
  servicios: many(profesionalesServicios),
  horarios: many(horarios),
  bloqueos: many(bloqueos),
  reservas: many(reservas),
}));

export const profesionalesServiciosRelations = relations(profesionalesServicios, ({ one }) => ({
  profesional: one(profesionales, {
    fields: [profesionalesServicios.profesionalId],
    references: [profesionales.id],
  }),
  servicio: one(servicios, {
    fields: [profesionalesServicios.servicioId],
    references: [servicios.id],
  }),
}));

export const horariosRelations = relations(horarios, ({ one }) => ({
  empresa: one(empresas, { fields: [horarios.empresaId], references: [empresas.id] }),
  profesional: one(profesionales, {
    fields: [horarios.profesionalId],
    references: [profesionales.id],
  }),
}));

export const bloqueosRelations = relations(bloqueos, ({ one }) => ({
  empresa: one(empresas, { fields: [bloqueos.empresaId], references: [empresas.id] }),
  profesional: one(profesionales, {
    fields: [bloqueos.profesionalId],
    references: [profesionales.id],
  }),
}));

export const clientesRelations = relations(clientes, ({ one, many }) => ({
  empresa: one(empresas, { fields: [clientes.empresaId], references: [empresas.id] }),
  reservas: many(reservas),
}));

export const reservasRelations = relations(reservas, ({ one, many }) => ({
  empresa: one(empresas, { fields: [reservas.empresaId], references: [empresas.id] }),
  servicio: one(servicios, { fields: [reservas.servicioId], references: [servicios.id] }),
  profesional: one(profesionales, {
    fields: [reservas.profesionalId],
    references: [profesionales.id],
  }),
  cliente: one(clientes, { fields: [reservas.clienteId], references: [clientes.id] }),
  creadoPor: one(usuarios, { fields: [reservas.creadoPorId], references: [usuarios.id] }),
  notificaciones: many(notificaciones),
}));

export const notificacionesRelations = relations(notificaciones, ({ one }) => ({
  empresa: one(empresas, { fields: [notificaciones.empresaId], references: [empresas.id] }),
  reserva: one(reservas, { fields: [notificaciones.reservaId], references: [reservas.id] }),
}));

export const auditoriaRelations = relations(auditoria, ({ one }) => ({
  empresa: one(empresas, { fields: [auditoria.empresaId], references: [empresas.id] }),
  actor: one(usuarios, { fields: [auditoria.actorId], references: [usuarios.id] }),
}));
