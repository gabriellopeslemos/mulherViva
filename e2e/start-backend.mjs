// Sobe o backend FastAPI para os testes e2e com um SQLite descartável e
// integrações externas desligadas. Chamado pelo webServer do Playwright.
import { spawn } from 'node:child_process'
import { rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { E2E_SECRET_KEY, E2E_ADMIN_EMAIL } from './helpers/constants.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = join(root, 'backend')
const apiPort = process.env.E2E_API_PORT || '8001'
const webPort = process.env.E2E_WEB_PORT || '5174'

const dataDir = join(root, 'test-results', 'e2e-db')
mkdirSync(dataDir, { recursive: true })
const dbFile = join(dataDir, `e2e-${apiPort}.db`)
rmSync(dbFile, { force: true })

const python = join(
  backendDir,
  'venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)

const env = {
  ...process.env,
  DATABASE_URL: `sqlite:///${dbFile.replaceAll('\\', '/')}`,
  SECRET_KEY: E2E_SECRET_KEY,
  ACCESS_TOKEN_EXPIRE_MINUTES: '720',
  DEV_AUTH_BYPASS: 'true',
  ALLOWED_ADMIN_EMAILS: E2E_ADMIN_EMAIL,
  CORS_ORIGINS: `http://127.0.0.1:${webPort}`,
  PUBLIC_BASE_URL: `http://127.0.0.1:${webPort}`,
  // backend/.env é lido pelo pydantic-settings; estas chaves sobrescrevem e
  // garantem que nada toque a rede (e-mail, Instagram, Google).
  NOTIFICATIONS_ENABLED: 'false',
  RESEND_API_KEY: '',
  SMTP_HOST: '',
  IG_AUTO_SYNC: 'false',
  IG_ACCESS_TOKEN: '',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
  // Políticas determinísticas (independem do .env do desenvolvedor).
  MIN_BOOKING_LEAD_HOURS: '2',
  BUFFER_MINUTES: '0',
  CANCELLATION_WINDOW_HOURS: '12',
  MAX_BOOKING_ADVANCE_DAYS: '60',
  CLINIC_NOTIFICATION_EMAILS: '',
}

const child = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', apiPort],
  { cwd: backendDir, env, stdio: 'inherit' },
)
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill())
