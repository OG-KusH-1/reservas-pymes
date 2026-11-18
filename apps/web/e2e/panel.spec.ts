import { expect, test } from '@playwright/test';

/**
 * Pruebas E2E de protección de rutas del panel (`/panel/**`).
 *
 * Verifican que `proxy.ts` redirige las visitas anónimas (sin cookie
 * `agenda_sesion`) hacia `/ingresar?siguiente=...` antes de llegar a la API.
 */
test.describe('protección del panel', () => {
  test('visitar /panel sin cookie redirige a /ingresar?siguiente=%2Fpanel', async ({ page }) => {
    await page.goto('/panel');

    await expect(page).toHaveURL('/ingresar?siguiente=%2Fpanel');
    await expect(page.getByRole('heading', { level: 1, name: 'Ingresar' })).toBeVisible();
  });

  test('visitar una subruta del panel sin cookie conserva la ruta en ?siguiente=', async ({
    page,
  }) => {
    await page.goto('/panel/reservas');

    await expect(page).toHaveURL('/ingresar?siguiente=%2Fpanel%2Freservas');
  });
});
