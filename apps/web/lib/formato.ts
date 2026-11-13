import { DateTime } from 'luxon';

/**
 * Formato de fechas, horas y dinero para la interfaz.
 *
 * Regla central: un instante se muestra SIEMPRE en la zona horaria de la
 * empresa, no en la del navegador. Una reserva a las 10:00 en Santiago debe
 * leerse «10:00» también para quien la mira desde otro país. Por eso todas
 * las funciones de fecha exigen la zona como argumento.
 *
 * Los instantes llegan de la API como texto ISO 8601 en UTC.
 */

export const LOCALE = 'es-CL';
/** Zona usada solo cuando aún no se conoce la de la empresa. */
export const ZONA_PREDETERMINADA = 'America/Santiago';

function enZona(instanteIso: string, zona: string): DateTime {
  return DateTime.fromISO(instanteIso, { zone: 'utc' }).setZone(zona).setLocale(LOCALE);
}

/** `10:30` */
export function formatearHora(instanteIso: string, zona: string): string {
  return enZona(instanteIso, zona).toFormat('HH:mm');
}

/** `viernes 13 de noviembre de 2026` */
export function formatearFechaLarga(instanteIso: string, zona: string): string {
  return enZona(instanteIso, zona).toFormat("cccc d 'de' LLLL 'de' yyyy");
}

/** `13-11-2026` */
export function formatearFechaCorta(instanteIso: string, zona: string): string {
  return enZona(instanteIso, zona).toFormat('dd-LL-yyyy');
}

/** `10:30 – 11:15` */
export function formatearRangoHorario(inicioIso: string, finIso: string, zona: string): string {
  return `${formatearHora(inicioIso, zona)} – ${formatearHora(finIso, zona)}`;
}

/**
 * Formatea un monto expresado en la unidad mínima de la moneda (enteros).
 * `formatearMoneda(15000)` → `$15.000`
 */
export function formatearMoneda(monto: number, moneda = 'CLP'): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'CLP' ? 0 : 2,
  }).format(monto);
}

/** `45 min`, `1 h`, `1 h 30 min` */
export function formatearDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}
