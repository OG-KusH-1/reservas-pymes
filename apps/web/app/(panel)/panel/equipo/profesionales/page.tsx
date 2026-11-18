import type { Metadata } from 'next';
import { GestionProfesionales } from '@/components/profesionales/gestion-profesionales';

export const metadata: Metadata = { title: 'Profesionales' };

/** Página de gestión de profesionales dentro del panel. */
export default function ProfesionalesPage() {
  return <GestionProfesionales />;
}
