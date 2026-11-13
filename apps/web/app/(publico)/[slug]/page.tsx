import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { slugSchema } from '@portfolio/contracts';
import { EnConstruccion } from '@/components/en-construccion';
import { RUTAS } from '@/lib/rutas';

interface Props {
  // En Next 16 los parámetros de ruta llegan como promesa.
  params: Promise<{ slug: string }>;
}

export const metadata: Metadata = { title: 'Reservar' };

/**
 * Página pública de reservas de una empresa (`/{slug}`).
 *
 * Al ser una ruta dinámica de primer nivel, recibe cualquier URL que no
 * coincida con una ruta propia de la aplicación. Por eso se valida el formato
 * del slug antes de consultar nada: lo que no sea un slug válido responde 404
 * sin tocar la API.
 *
 * La tarea T30 reemplaza el contenido por el flujo de reserva y T32 agrega
 * los metadatos de SEO por empresa (`generateMetadata`).
 */
export default async function EmpresaPublicaPage({ params }: Props) {
  const { slug } = await params;
  const validado = slugSchema.safeParse(slug);
  if (!validado.success) notFound();
  // El esquema normaliza (minúsculas, sin espacios). Si la URL no venía en su
  // forma canónica se redirige a ella, para que cada empresa tenga una única
  // dirección (evita contenido duplicado ante los buscadores).
  if (validado.data !== slug) permanentRedirect(RUTAS.empresa(validado.data));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center px-4 py-12">
      <div className="w-full">
        <EnConstruccion titulo="Reserva en línea" tarea="T30" />
      </div>
    </main>
  );
}
