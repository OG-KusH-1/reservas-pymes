import { expect, test } from '@playwright/test';

/**
 * Pruebas E2E de las pantallas públicas de cuenta e invitación
 * (`/recuperar`, `/restablecer`, `/verificar` e `/invitacion`).
 *
 * Verifican que cada ruta renderiza su interfaz esperada y aplica las
 * validaciones básicas en el cliente sin depender de la API.
 */
test.describe('equipo y cuenta', () => {
  test('/recuperar carga y valida el correo al enviarse vacío', async ({ page }) => {
    await page.goto('/recuperar');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Recuperar contraseña' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Enviar enlace de recuperación' }).click();
    await expect(page.getByText('Correo electrónico inválido')).toBeVisible();
  });

  test('/restablecer informa enlace incompleto sin token y valida la contraseña con token', async ({
    page,
  }) => {
    await page.goto('/restablecer');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Restablecer contraseña' }),
    ).toBeVisible();
    await expect(page.getByText('Enlace inválido o incompleto')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Solicitar nuevo enlace' })).toHaveAttribute(
      'href',
      '/recuperar',
    );

    await page.goto('/restablecer?token=token-prueba');
    await page.getByRole('button', { name: 'Guardar nueva contraseña' }).click();
    await expect(page.getByText('Debe tener al menos 10 caracteres')).toBeVisible();
  });

  test('/verificar informa enlace incompleto cuando falta el token', async ({ page }) => {
    await page.goto('/verificar');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Verificación de correo' }),
    ).toBeVisible();
    await expect(page.getByText('Enlace inválido o incompleto')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
  });

  test('/invitacion informa invitación incompleta cuando falta el token', async ({ page }) => {
    await page.goto('/invitacion');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Invitación al equipo' }),
    ).toBeVisible();
    await expect(page.getByText('Invitación inválida o incompleta')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir a ingresar' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
  });
});
