import { expect, test } from '@playwright/test';

/**
 * Pruebas E2E de las pantallas de acceso (`/ingresar` y `/registro`).
 *
 * Verifican que ambas rutas renderizan sus formularios, navegan entre sí y
 * validan campos vacíos en el cliente sin depender de la API.
 */
test.describe('autenticación', () => {
  test('las pantallas de ingreso y registro cargan y navegan entre sí', async ({ page }) => {
    await page.goto('/ingresar');

    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
    await page.getByRole('link', { name: 'Crear cuenta' }).click();

    await expect(page).toHaveURL('/registro');
    await expect(page.getByRole('heading', { level: 1, name: 'Crear cuenta' })).toBeVisible();

    await page.getByRole('link', { name: 'Ya tengo cuenta' }).click();
    await expect(page).toHaveURL('/ingresar');
  });

  test('el formulario de ingreso muestra errores de validación al enviarse vacío', async ({
    page,
  }) => {
    await page.goto('/ingresar');

    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByText('Correo electrónico inválido')).toBeVisible();
    await expect(page.getByText('Ingresa tu contraseña')).toBeVisible();
  });

  test('el formulario de registro muestra errores de validación al enviarse vacío', async ({
    page,
  }) => {
    await page.goto('/registro');

    await page.getByRole('button', { name: 'Crear cuenta' }).click();

    await expect(page.getByText('Debe tener al menos 2 caracteres').first()).toBeVisible();
    await expect(page.getByText('Debe tener al menos 3 caracteres')).toBeVisible();
    await expect(page.getByText('Correo electrónico inválido')).toBeVisible();
    await expect(page.getByText('Debe tener al menos 10 caracteres')).toBeVisible();
  });
});
