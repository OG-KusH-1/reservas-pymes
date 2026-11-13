import { describe, expect, it } from 'vitest';
import { validarEntorno } from './env.js';

const minimo = { DATABASE_URL: 'postgresql://u:p@localhost:5432/agenda' };

describe('validarEntorno', () => {
  it('aplica valores por defecto y convierte los números', () => {
    const env = validarEntorno({ ...minimo, PORT: '4100' });

    expect(env.PORT).toBe(4100);
    expect(env.NODE_ENV).toBe('development');
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.SMTP_SECURE).toBe(false);
  });

  it('reduce WEB_URL a su origen, sin barra final ni ruta', () => {
    expect(validarEntorno({ ...minimo, WEB_URL: 'https://agenda.cl/' }).WEB_URL).toBe(
      'https://agenda.cl',
    );
    expect(validarEntorno({ ...minimo, WEB_URL: 'http://localhost:3000/panel' }).WEB_URL).toBe(
      'http://localhost:3000',
    );
  });

  it('se niega a arrancar sin DATABASE_URL e indica la variable', () => {
    expect(() => validarEntorno({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza una cadena de conexión que no es de PostgreSQL', () => {
    expect(() => validarEntorno({ DATABASE_URL: 'mysql://u:p@localhost/x' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rechaza valores fuera de rango', () => {
    expect(() => validarEntorno({ ...minimo, PORT: '70000' })).toThrow(/PORT/);
    expect(() => validarEntorno({ ...minimo, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
