import type { Metadata } from 'next';
import { EnConstruccion } from '@/components/en-construccion';

export const metadata: Metadata = { title: 'Ingresar' };

export default function IngresarPage() {
  return <EnConstruccion titulo="Ingresar" tarea="T11" />;
}
