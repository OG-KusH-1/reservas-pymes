import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const servicio = new PasswordService();

  it('genera un hash Argon2id distinto de la contraseña en claro y lo verifica', async () => {
    const clave = 'clave-segura-de-prueba';
    const hash = await servicio.hash(clave);

    expect(hash).not.toBe(clave);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(servicio.verificar(hash, clave)).resolves.toBe(true);
  });

  it('rechaza una contraseña distinta a la original', async () => {
    const hash = await servicio.hash('clave-segura-de-prueba');

    await expect(servicio.verificar(hash, 'otra-clave-diferente')).resolves.toBe(false);
  });

  it('devuelve false si el hash almacenado tiene formato inválido', async () => {
    await expect(servicio.verificar('hash-corrupto', 'cualquiera')).resolves.toBe(false);
  });

  it('ejecuta la verificación ficticia sin lanzar errores', async () => {
    await expect(servicio.verificarFicticio('cualquier-clave')).resolves.toBeUndefined();
  });
});
