import type { Metadata } from 'next';
import { GestionEquipo } from '@/components/equipo/gestion-equipo';

export const metadata: Metadata = { title: 'Equipo' };

/** Página de gestión de miembros e invitaciones dentro del panel. */
export default function EquipoPage() {
  return <GestionEquipo />;
}
