import type { Metadata } from 'next';
import { EstadoSistema } from '@/components/estado-sistema';
import { Marca } from '@/components/layout/marca';

export const metadata: Metadata = { title: 'Estado del sistema' };

/** Página pública de estado: comprueba en vivo la conexión web → API → base de datos. */
export default function EstadoPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-4 py-12">
      <Marca />
      <EstadoSistema />
    </main>
  );
}
