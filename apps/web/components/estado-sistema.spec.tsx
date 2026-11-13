import type { Salud } from '@portfolio/contracts';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderConProveedores, simularFetch } from '@/test/utilidades';
import { EstadoSistema } from './estado-sistema';

const salud: Salud = {
  status: 'ok',
  timestamp: '2026-11-13T12:00:00.000Z',
  uptime: 120,
  environment: 'test',
  services: { api: 'healthy', database: 'connected' },
  version: '0.1.0',
};

describe('EstadoSistema', () => {
  it('muestra el estado cuando la API responde', async () => {
    simularFetch(200, salud);

    renderConProveedores(<EstadoSistema />);

    expect(await screen.findByText('Operativa')).toBeInTheDocument();
    expect(screen.getByText('Conectada')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
  });

  it('indica cuando la base de datos no está disponible', async () => {
    simularFetch(200, {
      ...salud,
      status: 'degraded',
      services: { api: 'healthy', database: 'disconnected' },
    });

    renderConProveedores(<EstadoSistema />);

    expect(await screen.findByText('Degradada')).toBeInTheDocument();
    expect(screen.getByText('Sin conexión')).toBeInTheDocument();
  });

  it('muestra un mensaje de error cuando la API no responde', async () => {
    simularFetch(503, { codigo: 'INTERNO', mensaje: 'Servicio no disponible' });

    renderConProveedores(<EstadoSistema />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Servicio no disponible');
  });
});
