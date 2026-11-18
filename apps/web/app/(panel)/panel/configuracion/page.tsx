import type { Metadata } from 'next';
import { ConfiguracionEmpresa } from '@/components/configuracion/configuracion-empresa';

export const metadata: Metadata = { title: 'Configuración' };

/** Página de configuración de la empresa activa y sus políticas de reserva. */
export default function ConfiguracionPage() {
  return <ConfiguracionEmpresa />;
}
