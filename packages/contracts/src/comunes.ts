import { z } from 'zod';

/**
 * Piezas de validación reutilizables. Los DTO de cada módulo deben componerse
 * con estas piezas en lugar de repetir reglas, para que un mismo dato se valide
 * igual en todos los formularios y endpoints.
 */

export const idSchema = z.uuid();

/** Correo normalizado (sin espacios y en minúsculas) para compararlo sin ambigüedad. */
export const correoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Correo electrónico inválido').max(255));

/**
 * Slugs que ninguna empresa puede usar porque coinciden con rutas propias de
 * la aplicación: la página pública de una empresa vive en `/{slug}` y quedaría
 * tapada por la ruta del sistema (o al revés).
 *
 * Al crear una ruta de primer nivel en la web, agrégala aquí.
 */
export const SLUGS_RESERVADOS: readonly string[] = [
  'api',
  'panel',
  'ingresar',
  'registro',
  'recuperar',
  'restablecer',
  'verificar',
  'invitacion',
  'reserva',
  'estado',
  'admin',
  'ayuda',
  'terminos',
  'privacidad',
];

/**
 * Identificador público de la empresa en la URL (`/{slug}`).
 * Minúsculas, números y guiones; sin guion al inicio ni al final.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Debe tener al menos 3 caracteres')
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones')
  .refine((slug) => !SLUGS_RESERVADOS.includes(slug), 'Ese nombre no está disponible');

/** Hora local del día en formato de 24 horas `HH:mm`. */
export const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora inválido (HH:mm)');

/** Fecha de calendario `AAAA-MM-DD`, sin hora ni zona. */
export const fechaSchema = z.iso.date();

/** Instante exacto en ISO 8601 con zona (`2026-11-13T15:00:00Z`). */
export const instanteSchema = z.iso.datetime({ offset: true });

/**
 * Monto en la unidad mínima de la moneda (pesos en CLP, que no tiene decimales).
 * Siempre entero para evitar errores de redondeo.
 */
export const montoSchema = z.number().int().min(0);

/**
 * Zona horaria IANA (`America/Santiago`). Se valida contra las zonas que
 * conoce el motor de JavaScript: una zona inexistente haría fallar todos los
 * cálculos de disponibilidad y el formato de fechas de la empresa.
 */
export const zonaHorariaSchema = z
  .string()
  .max(64)
  .refine((zona) => {
    try {
      new Intl.DateTimeFormat('es', { timeZone: zona });
      return true;
    } catch {
      return false;
    }
  }, 'Zona horaria inválida');

/** Día de la semana: 0 = domingo … 6 = sábado (igual que `Date.getDay()`). */
export const diaSemanaSchema = z.number().int().min(0).max(6);
