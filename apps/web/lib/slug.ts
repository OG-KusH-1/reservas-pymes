/**
 * Convierte el nombre de una empresa en una sugerencia de slug para su URL
 * pública (`/{slug}`).
 *
 * Normaliza tildes y la letra `ñ` (`ñ` → `n`), transforma espacios y símbolos en
 * guiones simples, recorta a un máximo de 100 caracteres y elimina guiones en
 * los extremos **después** de truncar para que el corte nunca deje un guion
 * colgante.
 *
 * Es solo una sugerencia de formato: no comprueba palabras reservadas
 * (`SLUGS_RESERVADOS`) ni disponibilidad; esa validación la realiza
 * `slugSchema` en el formulario y en la API.
 *
 * @example
 * sugerirSlug('Peluquería Ñuñoa & Spa!') // 'peluqueria-nunoa-spa'
 */
export function sugerirSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');
}
