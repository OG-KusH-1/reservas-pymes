import { SLUGS_RESERVADOS, slugSchema } from '@portfolio/contracts';
import { describe, expect, it } from 'vitest';
import { sugerirSlug } from './slug';

describe('sugerirSlug', () => {
  it('convierte a minúsculas, quita tildes, transforma ñ en n y reemplaza espacios y símbolos', () => {
    expect(sugerirSlug('Peluquería Ñuñoa & Spa!')).toBe('peluqueria-nunoa-spa');
    expect(sugerirSlug('  Centro   Kinesiológico  Álamo  ')).toBe('centro-kinesiologico-alamo');
    expect(sugerirSlug('Estética 100% Natural')).toBe('estetica-100-natural');
  });

  it('trunca a 100 caracteres y recorta el guion final si el corte cae en un separador', () => {
    // 99 'a' + espacio + 'b' → al truncar a 100 queda un guion al final que debe eliminarse.
    const nombreConSeparadorEn100 = `${'a'.repeat(99)} bbbbb`;
    const resultado = sugerirSlug(nombreConSeparadorEn100);

    expect(resultado.length).toBeLessThanOrEqual(100);
    expect(resultado).toBe('a'.repeat(99));
    expect(resultado.endsWith('-')).toBe(false);
    expect(slugSchema.safeParse(resultado).success).toBe(true);
  });

  it('produce un slug válido según slugSchema cuando el nombre tiene al menos 3 alfanuméricos y no es reservado', () => {
    const nombres = ['Barbería Sur', 'Clínica Dental 24/7', 'Café & Taller', 'abc'];

    for (const nombre of nombres) {
      const slug = sugerirSlug(nombre);
      expect(SLUGS_RESERVADOS).not.toContain(slug);
      expect(slugSchema.safeParse(slug).success).toBe(true);
    }
  });

  it('produce una palabra reservada si el nombre coincide con una (p. ej. Panel → panel)', () => {
    const slug = sugerirSlug('Panel');

    expect(slug).toBe('panel');
    expect(SLUGS_RESERVADOS).toContain(slug);
    expect(slugSchema.safeParse(slug).success).toBe(false);
  });
});
