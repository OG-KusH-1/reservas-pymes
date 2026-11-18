import { describe, expect, it } from 'vitest';
import {
  VIGENCIA_TOKEN_MS,
  calcularExpiracionToken,
  generarTokenVerificacion,
  hashTokenVerificacion,
} from './cuenta.service.js';

describe('tokens de verificación y recuperación', () => {
  it('genera un token base64url aleatorio cuyo hash SHA-256 difiere del token en claro', () => {
    const primero = generarTokenVerificacion();
    const segundo = generarTokenVerificacion();

    expect(primero.token).not.toBe(primero.tokenHash);
    expect(primero.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(primero.tokenHash).toBe(hashTokenVerificacion(primero.token));
    expect(primero.token).not.toBe(segundo.token);
  });

  it('calcula vigencia de 24 horas para verificar_correo y 1 hora para recuperar_contrasena', () => {
    const base = new Date('2026-11-18T12:00:00.000Z');

    const expiraVerificar = calcularExpiracionToken('verificar_correo', base);
    const expiraRecuperar = calcularExpiracionToken('recuperar_contrasena', base);

    expect(expiraVerificar.getTime() - base.getTime()).toBe(VIGENCIA_TOKEN_MS.verificar_correo);
    expect(expiraRecuperar.getTime() - base.getTime()).toBe(VIGENCIA_TOKEN_MS.recuperar_contrasena);
    expect(VIGENCIA_TOKEN_MS.verificar_correo).toBe(24 * 60 * 60 * 1000);
    expect(VIGENCIA_TOKEN_MS.recuperar_contrasena).toBe(60 * 60 * 1000);
  });
});
