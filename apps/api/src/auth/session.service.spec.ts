import { describe, expect, it } from 'vitest';
import { evaluarVigenciaSesion, hashTokenSesion } from './session.service.js';

describe('lógica de vigencia de sesión', () => {
  const ahora = new Date('2026-11-18T12:00:00Z');
  const estadoBase = {
    expiraEn: new Date('2026-12-18T12:00:00Z'),
    revocadaEn: null,
    ultimoUsoEn: new Date('2026-11-18T11:30:00Z'),
    usuarioActivo: true,
    empresaActiva: true,
    miembroActivo: true,
  };

  it('considera vigente una sesión activa y no la renueva antes de 1 hora', () => {
    expect(evaluarVigenciaSesion(estadoBase, ahora)).toEqual({
      vigente: true,
      debeRenovar: false,
    });
  });

  it('indica renovación deslizante cuando pasó al menos 1 hora desde el último uso', () => {
    const haceUnaHora = new Date('2026-11-18T11:00:00Z');
    expect(evaluarVigenciaSesion({ ...estadoBase, ultimoUsoEn: haceUnaHora }, ahora)).toEqual({
      vigente: true,
      debeRenovar: true,
    });
  });

  it('rechaza sesiones expiradas', () => {
    expect(evaluarVigenciaSesion({ ...estadoBase, expiraEn: ahora }, ahora)).toEqual({
      vigente: false,
      debeRenovar: false,
    });
  });

  it('rechaza sesiones revocadas', () => {
    expect(
      evaluarVigenciaSesion({ ...estadoBase, revocadaEn: new Date('2026-11-18T10:00:00Z') }, ahora),
    ).toEqual({
      vigente: false,
      debeRenovar: false,
    });
  });

  it('rechaza sesiones cuando usuario, empresa o membresía están inactivos', () => {
    expect(evaluarVigenciaSesion({ ...estadoBase, usuarioActivo: false }, ahora).vigente).toBe(
      false,
    );
    expect(evaluarVigenciaSesion({ ...estadoBase, empresaActiva: false }, ahora).vigente).toBe(
      false,
    );
    expect(evaluarVigenciaSesion({ ...estadoBase, miembroActivo: false }, ahora).vigente).toBe(
      false,
    );
  });

  it('genera un hash SHA-256 determinista de 64 caracteres hexadecimales', () => {
    const hash = hashTokenSesion('token-de-prueba');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashTokenSesion('token-de-prueba'));
    expect(hash).not.toBe(hashTokenSesion('otro-token'));
  });
});
