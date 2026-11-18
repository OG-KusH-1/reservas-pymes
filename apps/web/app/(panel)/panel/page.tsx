import type { Metadata } from 'next';
import { InicioPanel } from '@/components/panel/inicio-panel';

export const metadata: Metadata = { title: 'Panel' };

/** Página principal del panel interno con bienvenida y accesos rápidos por rol. */
export default function PanelPage() {
  return <InicioPanel />;
}
