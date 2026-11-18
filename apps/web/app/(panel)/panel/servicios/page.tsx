import type { Metadata } from 'next';
import { GestionServicios } from '@/components/servicios/gestion-servicios';

export const metadata: Metadata = { title: 'Servicios' };

/** Página de gestión del catálogo de servicios dentro del panel. */
export default function ServiciosPage() {
  return <GestionServicios />;
}
