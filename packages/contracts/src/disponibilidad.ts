import { z } from 'zod';
import { diaSemanaSchema, horaSchema, idSchema, instanteSchema } from './comunes.js';

/**
 * Contrato de horarios semanales y bloqueos de disponibilidad de la empresa
 * activa (endpoints bajo `/api/v1/profesionales/:id/horarios` y `/api/v1/bloqueos`).
 *
 * | Método y ruta                   | Entrada                     | Éxito                     |
 * | ------------------------------- | --------------------------- | ------------------------- |
 * | `GET /profesionales/:id/horarios` | —                         | `tramoHorarioSchema[]`    |
 * | `PUT /profesionales/:id/horarios` | `reemplazarHorariosSchema`| `tramoHorarioSchema[]`    |
 * | `GET /bloqueos`                 | `consultaBloqueosSchema`    | `bloqueoSchema[]`         |
 * | `POST /bloqueos`                | `crearBloqueoSchema`        | 201 + `resultadoBloqueoSchema` |
 * | `PATCH /bloqueos/:id`           | `actualizarBloqueoSchema`   | `resultadoBloqueoSchema`  |
 * | `DELETE /bloqueos/:id`          | —                           | 204                       |
 */

/** Tramo de atención semanal de un profesional en hora local de la empresa. */
export const tramoHorarioSchema = z.object({
  id: idSchema,
  profesionalId: idSchema,
  diaSemana: diaSemanaSchema,
  horaInicio: horaSchema,
  horaFin: horaSchema,
  activo: z.boolean(),
  creadoEn: instanteSchema,
});
export type TramoHorario = z.infer<typeof tramoHorarioSchema>;

/** Tramo de entrada para configurar la disponibilidad semanal de un profesional. */
export const tramoHorarioEntradaSchema = z
  .object({
    diaSemana: diaSemanaSchema,
    horaInicio: horaSchema,
    horaFin: horaSchema,
    activo: z.boolean().default(true),
  })
  .refine((tramo) => tramo.horaInicio < tramo.horaFin, {
    message: 'La hora de inicio debe ser anterior a la hora de fin',
    path: ['horaFin'],
  });
export type TramoHorarioEntrada = z.infer<typeof tramoHorarioEntradaSchema>;

/**
 * Reemplazo completo de los tramos semanales de un profesional.
 *
 * Valida que los tramos de un mismo día no se solapen entre sí; los tramos
 * contiguos (por ejemplo `09:00–13:00` y `13:00–18:00`) sí son válidos porque
 * representan intervalos semiabiertos `[horaInicio, horaFin)`.
 */
export const reemplazarHorariosSchema = z
  .object({
    tramos: z.array(tramoHorarioEntradaSchema),
  })
  .superRefine((datos, ctx) => {
    const porDia = new Map<
      number,
      Array<{ indice: number; horaInicio: string; horaFin: string }>
    >();

    datos.tramos.forEach((tramo, indice) => {
      const lista = porDia.get(tramo.diaSemana) ?? [];
      lista.push({ indice, horaInicio: tramo.horaInicio, horaFin: tramo.horaFin });
      porDia.set(tramo.diaSemana, lista);
    });

    for (const tramosDia of porDia.values()) {
      const ordenados = [...tramosDia].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
      for (let i = 1; i < ordenados.length; i++) {
        const anterior = ordenados[i - 1]!;
        const actual = ordenados[i]!;
        if (actual.horaInicio < anterior.horaFin) {
          ctx.addIssue({
            code: 'custom',
            message: 'Los tramos de un mismo día no pueden solaparse',
            path: ['tramos', actual.indice, 'horaInicio'],
          });
        }
      }
    }
  });
export type ReemplazarHorarios = z.infer<typeof reemplazarHorariosSchema>;

/**
 * Excepción puntual de disponibilidad (feriado, vacaciones, colación o reunión).
 * Si `profesionalId` es `null`, el bloqueo aplica a toda la empresa.
 */
export const bloqueoSchema = z.object({
  id: idSchema,
  profesionalId: idSchema.nullable(),
  inicio: instanteSchema,
  fin: instanteSchema,
  motivo: z.string().nullable(),
  creadoEn: instanteSchema,
});
export type Bloqueo = z.infer<typeof bloqueoSchema>;

/** Parámetros de consulta para listar bloqueos en un rango de fechas. */
export const consultaBloqueosSchema = z
  .object({
    desde: instanteSchema.optional(),
    hasta: instanteSchema.optional(),
    profesionalId: idSchema.optional(),
  })
  .refine(
    (datos) => {
      if (datos.desde !== undefined && datos.hasta !== undefined) {
        return Date.parse(datos.desde) <= Date.parse(datos.hasta);
      }
      return true;
    },
    {
      message: 'La fecha «desde» no puede ser posterior a «hasta»',
      path: ['hasta'],
    },
  );
export type ConsultaBloqueos = z.infer<typeof consultaBloqueosSchema>;

/** Datos para crear un bloqueo puntual de empresa (`profesionalId: null`) o de profesional. */
export const crearBloqueoSchema = z
  .object({
    profesionalId: idSchema.nullable().default(null),
    inicio: instanteSchema,
    fin: instanteSchema,
    motivo: z.string().trim().min(1, 'No puede estar vacío').max(255).nullable().optional(),
  })
  .refine((datos) => Date.parse(datos.inicio) < Date.parse(datos.fin), {
    message: 'La fecha de inicio debe ser anterior a la fecha de fin',
    path: ['fin'],
  });
export type CrearBloqueo = z.infer<typeof crearBloqueoSchema>;

/**
 * Actualización parcial de un bloqueo existente. Se exige al menos un campo
 * para preservar la semántica de `PATCH`.
 */
export const actualizarBloqueoSchema = z
  .object({
    inicio: instanteSchema.optional(),
    fin: instanteSchema.optional(),
    motivo: z.string().trim().min(1, 'No puede estar vacío').max(255).nullable().optional(),
  })
  .refine((datos) => Object.values(datos).some((valor) => valor !== undefined), {
    message: 'Debe enviar al menos un campo para actualizar',
  })
  .refine(
    (datos) => {
      if (datos.inicio !== undefined && datos.fin !== undefined) {
        return Date.parse(datos.inicio) < Date.parse(datos.fin);
      }
      return true;
    },
    {
      message: 'La fecha de inicio debe ser anterior a la fecha de fin',
      path: ['fin'],
    },
  );
export type ActualizarBloqueo = z.infer<typeof actualizarBloqueoSchema>;

/**
 * Respuesta al crear o actualizar un bloqueo: incluye el conteo de reservas
 * activas (no canceladas) cuyo tramo ocupado se cruza con el bloqueo.
 */
export const resultadoBloqueoSchema = z.object({
  bloqueo: bloqueoSchema,
  reservasAfectadas: z.number().int().min(0),
});
export type ResultadoBloqueo = z.infer<typeof resultadoBloqueoSchema>;
