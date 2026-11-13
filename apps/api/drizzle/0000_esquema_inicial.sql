CREATE TYPE "public"."canal_notificacion" AS ENUM('correo', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."estado_notificacion" AS ENUM('pendiente', 'enviada', 'fallida');--> statement-breakpoint
CREATE TYPE "public"."estado_reserva" AS ENUM('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio');--> statement-breakpoint
CREATE TYPE "public"."origen_reserva" AS ENUM('panel', 'publico');--> statement-breakpoint
CREATE TYPE "public"."rol_miembro" AS ENUM('dueno', 'admin', 'recepcion', 'profesional');--> statement-breakpoint
CREATE TYPE "public"."tipo_token" AS ENUM('verificar_correo', 'recuperar_contrasena');--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"actor_id" uuid,
	"accion" varchar(100) NOT NULL,
	"entidad" varchar(50) NOT NULL,
	"entidad_id" uuid,
	"antes" jsonb,
	"despues" jsonb,
	"ip" varchar(45),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bloqueos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"profesional_id" uuid,
	"inicio" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"motivo" varchar(255),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bloqueos_rango_chk" CHECK ("bloqueos"."inicio" < "bloqueos"."fin")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telefono" varchar(50),
	"notas" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"rut" varchar(20),
	"email" varchar(255),
	"telefono" varchar(50),
	"direccion" varchar(255),
	"zona_horaria" varchar(64) DEFAULT 'America/Santiago' NOT NULL,
	"moneda" varchar(3) DEFAULT 'CLP' NOT NULL,
	"anticipacion_minima_minutos" integer DEFAULT 60 NOT NULL,
	"anticipacion_maxima_dias" integer DEFAULT 60 NOT NULL,
	"cancelacion_minima_minutos" integer DEFAULT 120 NOT NULL,
	"intervalo_grilla_minutos" integer DEFAULT 15 NOT NULL,
	"confirmacion_automatica" boolean DEFAULT true NOT NULL,
	"recordatorio_horas_antes" integer DEFAULT 24 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "empresas_slug_unique" UNIQUE("slug"),
	CONSTRAINT "empresas_anticipacion_minima_chk" CHECK ("empresas"."anticipacion_minima_minutos" >= 0),
	CONSTRAINT "empresas_anticipacion_maxima_chk" CHECK ("empresas"."anticipacion_maxima_dias" > 0),
	CONSTRAINT "empresas_cancelacion_minima_chk" CHECK ("empresas"."cancelacion_minima_minutos" >= 0),
	CONSTRAINT "empresas_intervalo_grilla_chk" CHECK ("empresas"."intervalo_grilla_minutos" BETWEEN 5 AND 120),
	CONSTRAINT "empresas_recordatorio_chk" CHECK ("empresas"."recordatorio_horas_antes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "horarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"profesional_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"hora_inicio" time NOT NULL,
	"hora_fin" time NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "horarios_dia_semana_chk" CHECK ("horarios"."dia_semana" BETWEEN 0 AND 6),
	CONSTRAINT "horarios_rango_chk" CHECK ("horarios"."hora_inicio" < "horarios"."hora_fin")
);
--> statement-breakpoint
CREATE TABLE "invitaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"rol" "rol_miembro" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invitado_por_id" uuid,
	"expira_en" timestamp with time zone NOT NULL,
	"aceptada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitaciones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "miembros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"rol" "rol_miembro" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"reserva_id" uuid,
	"canal" "canal_notificacion" NOT NULL,
	"plantilla" varchar(50) NOT NULL,
	"destinatario" varchar(255) NOT NULL,
	"estado" "estado_notificacion" DEFAULT 'pendiente' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"error" text,
	"programada_para" timestamp with time zone,
	"enviada_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profesionales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid,
	"nombre" varchar(255) NOT NULL,
	"email" varchar(255),
	"telefono" varchar(50),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profesionales_servicios" (
	"empresa_id" uuid NOT NULL,
	"profesional_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	CONSTRAINT "profesionales_servicios_profesional_id_servicio_id_pk" PRIMARY KEY("profesional_id","servicio_id")
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"servicio_id" uuid NOT NULL,
	"profesional_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"fecha_hora_inicio" timestamp with time zone NOT NULL,
	"fecha_hora_fin" timestamp with time zone NOT NULL,
	"bloqueo_hasta" timestamp with time zone NOT NULL,
	"estado" "estado_reserva" DEFAULT 'pendiente' NOT NULL,
	"origen" "origen_reserva" NOT NULL,
	"precio" integer NOT NULL,
	"duracion_minutos" integer NOT NULL,
	"notas" text,
	"notas_internas" text,
	"token_gestion_hash" varchar(64),
	"cancelada_en" timestamp with time zone,
	"motivo_cancelacion" varchar(255),
	"creado_por_id" uuid,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservas_token_gestion_hash_unique" UNIQUE("token_gestion_hash"),
	CONSTRAINT "reservas_rango_chk" CHECK ("reservas"."fecha_hora_inicio" < "reservas"."fecha_hora_fin"),
	CONSTRAINT "reservas_bloqueo_chk" CHECK ("reservas"."bloqueo_hasta" >= "reservas"."fecha_hora_fin"),
	CONSTRAINT "reservas_precio_chk" CHECK ("reservas"."precio" >= 0),
	CONSTRAINT "reservas_duracion_chk" CHECK ("reservas"."duracion_minutos" > 0)
);
--> statement-breakpoint
CREATE TABLE "servicios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"descripcion" text,
	"categoria" varchar(100),
	"duracion_minutos" integer DEFAULT 30 NOT NULL,
	"margen_posterior_minutos" integer DEFAULT 0 NOT NULL,
	"precio" integer DEFAULT 0 NOT NULL,
	"visible_publico" boolean DEFAULT true NOT NULL,
	"color" varchar(7),
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "servicios_duracion_chk" CHECK ("servicios"."duracion_minutos" > 0),
	CONSTRAINT "servicios_margen_chk" CHECK ("servicios"."margen_posterior_minutos" >= 0),
	CONSTRAINT "servicios_precio_chk" CHECK ("servicios"."precio" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sesiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"empresa_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"revocada_en" timestamp with time zone,
	"ip" varchar(45),
	"user_agent" text,
	"ultimo_uso_en" timestamp with time zone DEFAULT now() NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sesiones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tokens_verificacion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" "tipo_token" NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expira_en" timestamp with time zone NOT NULL,
	"usado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tokens_verificacion_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"nombre" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"email_verificado_en" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_actor_id_usuarios_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bloqueos" ADD CONSTRAINT "bloqueos_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_por_id_usuarios_id_fk" FOREIGN KEY ("invitado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "miembros" ADD CONSTRAINT "miembros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales" ADD CONSTRAINT "profesionales_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales_servicios" ADD CONSTRAINT "profesionales_servicios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales_servicios" ADD CONSTRAINT "profesionales_servicios_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profesionales_servicios" ADD CONSTRAINT "profesionales_servicios_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_servicio_id_servicios_id_fk" FOREIGN KEY ("servicio_id") REFERENCES "public"."servicios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_profesional_id_profesionales_id_fk" FOREIGN KEY ("profesional_id") REFERENCES "public"."profesionales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_creado_por_id_usuarios_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicios" ADD CONSTRAINT "servicios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens_verificacion" ADD CONSTRAINT "tokens_verificacion_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_empresa_creado_idx" ON "auditoria" USING btree ("empresa_id","creado_en");--> statement-breakpoint
CREATE INDEX "auditoria_entidad_idx" ON "auditoria" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "bloqueos_empresa_inicio_idx" ON "bloqueos" USING btree ("empresa_id","inicio");--> statement-breakpoint
CREATE INDEX "bloqueos_profesional_idx" ON "bloqueos" USING btree ("profesional_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_empresa_email_uq" ON "clientes" USING btree ("empresa_id","email");--> statement-breakpoint
CREATE INDEX "horarios_profesional_dia_idx" ON "horarios" USING btree ("profesional_id","dia_semana");--> statement-breakpoint
CREATE INDEX "horarios_empresa_idx" ON "horarios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "invitaciones_empresa_idx" ON "invitaciones" USING btree ("empresa_id");--> statement-breakpoint
CREATE UNIQUE INDEX "miembros_empresa_usuario_uq" ON "miembros" USING btree ("empresa_id","usuario_id");--> statement-breakpoint
CREATE INDEX "miembros_usuario_idx" ON "miembros" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "notificaciones_empresa_creado_idx" ON "notificaciones" USING btree ("empresa_id","creado_en");--> statement-breakpoint
CREATE INDEX "notificaciones_reserva_idx" ON "notificaciones" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "notificaciones_pendientes_idx" ON "notificaciones" USING btree ("estado","programada_para");--> statement-breakpoint
CREATE INDEX "profesionales_empresa_idx" ON "profesionales" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "profesionales_usuario_idx" ON "profesionales" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "profesionales_servicios_servicio_idx" ON "profesionales_servicios" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "profesionales_servicios_empresa_idx" ON "profesionales_servicios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "reservas_empresa_inicio_idx" ON "reservas" USING btree ("empresa_id","fecha_hora_inicio");--> statement-breakpoint
CREATE INDEX "reservas_profesional_inicio_idx" ON "reservas" USING btree ("profesional_id","fecha_hora_inicio");--> statement-breakpoint
CREATE INDEX "reservas_cliente_idx" ON "reservas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "reservas_servicio_idx" ON "reservas" USING btree ("servicio_id");--> statement-breakpoint
CREATE INDEX "servicios_empresa_idx" ON "servicios" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "sesiones_usuario_idx" ON "sesiones" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "sesiones_empresa_idx" ON "sesiones" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "sesiones_expira_idx" ON "sesiones" USING btree ("expira_en");--> statement-breakpoint
CREATE INDEX "tokens_verificacion_usuario_idx" ON "tokens_verificacion" USING btree ("usuario_id");