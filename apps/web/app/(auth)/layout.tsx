import { Marca } from '@/components/layout/marca';

/**
 * Layout de las pantallas de acceso (ingresar, registro, recuperación):
 * contenido centrado y angosto, sin navegación, para no distraer del formulario.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/40 flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Marca />
      <main className="w-full max-w-sm">{children}</main>
    </div>
  );
}
