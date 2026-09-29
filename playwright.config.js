import { defineConfig, devices } from '@playwright/test'

// Portas dedicadas (nunca 8000/5173) para não colidir com o dev server nem
// escrever no banco real. Execuções concorrentes usam portas diferentes.
const API_PORT = process.env.E2E_API_PORT || '8001'
const WEB_PORT = process.env.E2E_WEB_PORT || '5174'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.js',
  outputDir: `./test-results/${WEB_PORT}`,
  // Um único banco compartilhado: regras, períodos e AppSettings são globais.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Pula o SplashGate e reduz o Framer Motion.
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: `http://127.0.0.1:${API_PORT}/docs`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { E2E_API_PORT: API_PORT, E2E_WEB_PORT: WEB_PORT },
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}`, VITE_GOOGLE_CLIENT_ID: '', VITE_DEV_AUTH_BYPASS: 'true' },
    },
  ],
})
