import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo (E2E) con Playwright.
 *
 *   pnpm test:e2e            ejecuta las pruebas
 *   pnpm test:e2e -- --ui    modo interactivo
 *
 * Primera vez en una máquina: `pnpm --filter @portfolio/web exec playwright install chromium`.
 *
 * Las pruebas corren contra el build de producción de la web (`next start`),
 * que es lo que realmente se despliega. Playwright lo levanta solo; en local
 * reutiliza un servidor ya abierto en el puerto 3000 si existe.
 *
 * Hoy solo hay pruebas de humo que no necesitan la API. La tarea T42 agrega
 * los flujos completos (registro, reserva pública) y, con ellos, el arranque
 * de la API y de una base de datos de prueba en `webServer`.
 */
const PUERTO = 3000;
const esCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // En CI un `test.only` olvidado haría pasar la suite sin ejecutar el resto.
  forbidOnly: esCI,
  // El primer arranque de `next start` después de un build es lento (sobre
  // todo en Windows, donde el antivirus examina los archivos recién creados) y
  // las primeras navegaciones pueden tardar decenas de segundos. Por eso el
  // tiempo por prueba es holgado, hay un reintento también en local y se
  // limita la cantidad de navegadores simultáneos.
  timeout: 60_000,
  retries: esCI ? 2 : 1,
  workers: 2,
  reporter: esCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    // Guarda la traza solo al reintentar un fallo: permite reproducirlo paso a paso.
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
    // La página pública de reservas se usa sobre todo desde el celular.
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm start',
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: !esCI,
    timeout: 120_000,
  },
});
