import type { Metadata } from 'next';
import { EnConstruccion } from '@/components/en-construccion';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function RegistroPage() {
  return <EnConstruccion titulo="Crear cuenta" tarea="T11" />;
}
