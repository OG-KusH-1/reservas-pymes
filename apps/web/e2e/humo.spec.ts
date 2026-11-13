import { expect, test } from '@playwright/test';

/**
 * Pruebas de humo: comprueban que la web arranca y que la navegación básica
 * funciona. No dependen de la API ni de datos.
 */
test.describe('sitio público', () => {
  test('la página de inicio carga y ofrece crear una cuenta', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Reservas en línea');
    await page.getByRole('link', { name: 'Comenzar gratis' }).click();
    await expect(page).toHaveURL('/registro');
  });

  test('una ruta inexistente responde 404 con la página propia', async ({ page }) => {
    // El guion bajo no forma parte de un slug válido de empresa.
    const respuesta = await page.goto('/ruta_que_no_existe');

    expect(respuesta?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  });

  test('envía las cabeceras de seguridad', async ({ request }) => {
    const respuesta = await request.get('/');

    expect(respuesta.headers()['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers()['x-powered-by']).toBeUndefined();
  });
});
