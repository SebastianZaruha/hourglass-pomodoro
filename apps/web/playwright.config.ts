import { defineConfig, devices } from '@playwright/test';

/**
 * Siempre el build de producción. `vite dev` no es una prueba:
 * el minificador es el que se come el desenfoque.
 * HG_REUSE_PREVIEW=1 reutiliza un preview ya arrancado en el 4173
 * (tiene que ser ese build; el test rechaza el script de desarrollo).
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: process.env.HG_FASE ? '**/*.captura.ts' : '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results',
  reporter: [['list'], ['./e2e/informe.ts']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'es-ES',
    timezoneId: 'UTC',
    deviceScaleFactor: 1,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], deviceScaleFactor: 1 } }],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: process.env.HG_REUSE_PREVIEW === '1',
    timeout: 180_000,
  },
});
