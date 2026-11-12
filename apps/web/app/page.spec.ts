import { describe, it, expect } from 'vitest';

describe('Web App Environment & Config', () => {
  it('debe tener configurado el endpoint de API por defecto o por entorno', () => {
    const defaultApiUrl = 'http://localhost:4000';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || defaultApiUrl;
    expect(apiUrl).toBeDefined();
    expect(apiUrl).toContain('http');
  });
});
