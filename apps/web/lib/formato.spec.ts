import { describe, expect, it } from 'vitest';
import {
  formatearDuracion,
  formatearFechaLarga,
  formatearHora,
  formatearMoneda,
  formatearRangoHorario,
} from './formato';

describe('formato', () => {
  it('muestra la hora en la zona de la empresa, no en UTC', () => {
    // 13:00 UTC en noviembre es 10:00 en Santiago (UTC-3, horario de verano).
    expect(formatearHora('2026-11-13T13:00:00Z', 'America/Santiago')).toBe('10:00');
    expect(formatearHora('2026-11-13T13:00:00Z', 'America/Bogota')).toBe('08:00');
  });

  it('respeta el cambio de hora de la zona', () => {
    // En julio Santiago está en UTC-4 (horario de invierno).
    expect(formatearHora('2026-07-13T13:00:00Z', 'America/Santiago')).toBe('09:00');
  });

  it('formatea la fecha larga en español', () => {
    expect(formatearFechaLarga('2026-11-13T13:00:00Z', 'America/Santiago')).toBe(
      'viernes 13 de noviembre de 2026',
    );
  });

  it('usa la fecha local cuando el instante cae en otro día en UTC', () => {
    // 01:30 UTC del día 14 todavía es la noche del 13 en Santiago.
    expect(formatearFechaLarga('2026-11-14T01:30:00Z', 'America/Santiago')).toContain('13 de');
  });

  it('formatea un rango horario', () => {
    expect(
      formatearRangoHorario('2026-11-13T13:00:00Z', '2026-11-13T13:45:00Z', 'America/Santiago'),
    ).toBe('10:00 – 10:45');
  });

  it('formatea pesos chilenos sin decimales', () => {
    expect(formatearMoneda(15000)).toBe('$15.000');
  });

  it('formatea duraciones', () => {
    expect(formatearDuracion(45)).toBe('45 min');
    expect(formatearDuracion(60)).toBe('1 h');
    expect(formatearDuracion(90)).toBe('1 h 30 min');
  });
});
