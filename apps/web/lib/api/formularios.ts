import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { esApiError } from './errores';

/**
 * Traslada a un formulario de React Hook Form los errores de validación que
 * devolvió la API, para mostrarlos junto a cada campo.
 *
 * La web valida con el mismo esquema Zod que la API, así que normalmente el
 * error se detecta antes de enviar. Esto cubre las reglas que solo el servidor
 * puede comprobar (un correo ya registrado, un horario que se acaba de ocupar).
 *
 * @returns `true` si el error era de validación y se asignó al menos a un
 *   campo; `false` si quien llama debe mostrarlo de otra forma (un aviso).
 *
 * @example
 * onError: (error) => {
 *   if (!aplicarErroresAlFormulario(form, error)) toast.error(mensajeDeError(error));
 * }
 */
export function aplicarErroresAlFormulario<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
): boolean {
  if (!esApiError(error, 'VALIDACION')) return false;

  let asignados = 0;
  for (const detalle of error.detalles) {
    if (!detalle.campo) continue;
    form.setError(detalle.campo as Path<T>, { type: 'server', message: detalle.mensaje });
    asignados++;
  }
  return asignados > 0;
}
