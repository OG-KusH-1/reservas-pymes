import { describe, expect, it } from 'vitest';
import {
  consultaPaginadaSchema,
  correoSchema,
  ESTADOS_RESERVA,
  horaSchema,
  LIMITE_PAGINA_PREDETERMINADO,
  puedeTransicionar,
  slugSchema,
  TRANSICIONES_RESERVA,
} from './index.js';

describe('transiciones de reserva', () => {
  it('define una entrada para cada estado', () => {
    expect(Object.keys(TRANSICIONES_RESERVA).sort()).toEqual([...ESTADOS_RESERVA].sort());
  });

  it('permite confirmar una pendiente y no reabrir una cancelada', () => {
    expect(puedeTransicionar('pendiente', 'confirmada')).toBe(true);
    expect(puedeTransicionar('cancelada', 'confirmada')).toBe(false);
    expect(puedeTransicionar('pendiente', 'completada')).toBe(false);
  });
});

describe('piezas comunes', () => {
  it('normaliza el correo', () => {
    expect(correoSchema.parse('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(correoSchema.safeParse('no-es-correo').success).toBe(false);
  });

  it('valida el slug', () => {
    expect(slugSchema.safeParse('barberia-el-portal').success).toBe(true);
    expect(slugSchema.safeParse('-inicio').success).toBe(false);
    expect(slugSchema.safeParse('con espacios').success).toBe(false);
  });

  it('valida la hora HH:mm', () => {
    expect(horaSchema.safeParse('09:30').success).toBe(true);
    expect(horaSchema.safeParse('24:00').success).toBe(false);
  });
});

describe('paginación', () => {
  it('aplica el límite predeterminado y convierte el texto de la URL', () => {
    expect(consultaPaginadaSchema.parse({}).limite).toBe(LIMITE_PAGINA_PREDETERMINADO);
    expect(consultaPaginadaSchema.parse({ limite: '50' }).limite).toBe(50);
    expect(consultaPaginadaSchema.safeParse({ limite: '1000' }).success).toBe(false);
  });
});
