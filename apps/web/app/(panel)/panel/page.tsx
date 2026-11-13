import type { Metadata } from 'next';
import { EnConstruccion } from '@/components/en-construccion';

export const metadata: Metadata = { title: 'Panel' };

export default function PanelPage() {
  return <EnConstruccion titulo="Panel" tarea="T14" />;
}
