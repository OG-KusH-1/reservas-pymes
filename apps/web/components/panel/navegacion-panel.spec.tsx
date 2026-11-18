import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RUTAS } from '@/lib/rutas';
import { renderConProveedores } from '@/test/utilidades';
import { BarraLateralPanel, NavegacionMovil, filtrarNavegacionPorRol } from './navegacion-panel';

let pathnameActual = RUTAS.panel.inicio as string;

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameActual,
}));

describe('filtrarNavegacionPorRol', () => {
  it('muestra todas las secciones para dueño y administrador', () => {
    const etiquetasEsperadas = [
      'Inicio',
      'Agenda',
      'Reservas',
      'Clientes',
      'Servicios',
      'Equipo',
      'Configuración',
    ];

    expect(filtrarNavegacionPorRol('dueno').map((i) => i.etiqueta)).toEqual(etiquetasEsperadas);
    expect(filtrarNavegacionPorRol('admin').map((i) => i.etiqueta)).toEqual(etiquetasEsperadas);
  });

  it('oculta Configuración para recepción', () => {
    expect(filtrarNavegacionPorRol('recepcion').map((i) => i.etiqueta)).toEqual([
      'Inicio',
      'Agenda',
      'Reservas',
      'Clientes',
      'Servicios',
      'Equipo',
    ]);
  });

  it('oculta Clientes y Configuración para profesional', () => {
    expect(filtrarNavegacionPorRol('profesional').map((i) => i.etiqueta)).toEqual([
      'Inicio',
      'Agenda',
      'Reservas',
      'Servicios',
      'Equipo',
    ]);
  });
});

describe('BarraLateralPanel', () => {
  beforeEach(() => {
    pathnameActual = RUTAS.panel.inicio;
  });

  it('marca la ruta activa con aria-current="page"', () => {
    pathnameActual = RUTAS.panel.reservas;

    renderConProveedores(
      <TooltipProvider>
        <BarraLateralPanel rol="dueno" />
      </TooltipProvider>,
    );

    expect(screen.getByRole('link', { name: 'Reservas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('permite contraer y expandir la barra lateral', async () => {
    const usuario = userEvent.setup();

    renderConProveedores(
      <TooltipProvider>
        <BarraLateralPanel rol="dueno" />
      </TooltipProvider>,
    );

    const botonContraer = screen.getByRole('button', { name: 'Contraer navegación lateral' });
    expect(botonContraer).toHaveAttribute('aria-expanded', 'true');

    await usuario.click(botonContraer);

    const botonExpandir = screen.getByRole('button', { name: 'Expandir navegación lateral' });
    expect(botonExpandir).toHaveAttribute('aria-expanded', 'false');
    // Los enlaces siguen siendo accesibles por nombre aunque la barra esté contraída.
    expect(screen.getByRole('link', { name: 'Agenda' })).toBeInTheDocument();
  });
});

describe('NavegacionMovil', () => {
  beforeEach(() => {
    pathnameActual = RUTAS.panel.agenda;
  });

  it('abre el Sheet con los enlaces filtrados por rol al pulsar el botón de menú', async () => {
    const usuario = userEvent.setup();

    renderConProveedores(<NavegacionMovil rol="profesional" />);

    await usuario.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }));

    const nav = await screen.findByRole('navigation', { name: 'Navegación del panel' });
    expect(within(nav).getByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Configuración' })).not.toBeInTheDocument();
  });
});
