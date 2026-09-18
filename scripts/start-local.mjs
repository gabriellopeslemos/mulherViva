#!/usr/bin/env node
// Sobe frontend (vite) e backend (uvicorn) juntos para desenvolvimento local.
// Reinicia automaticamente o processo correspondente quando o .env dele muda
// (uvicorn --reload so observa arquivos .py, entao .env precisa de um watch a parte).
import { spawn, spawnSync } from 'node:child_process'
import { watch, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const backendDir = join(rootDir, 'backend')
const isWin = process.platform === 'win32'

const pythonBin = join(backendDir, '.venv', isWin ? 'Scripts/python.exe' : 'bin/python')
const npmCmd = isWin ? 'npm.cmd' : 'npm'

const colors = { backend: '\x1b[36m', frontend: '\x1b[35m', reset: '\x1b[0m' }

function log(name, line) {
  const color = colors[name] ?? ''
  process.stdout.write(`${color}[${name}]${colors.reset} ${line}\n`)
}

function pipe(name, stream) {
  let buf = ''
  stream.on('data', (chunk) => {
    buf += chunk.toString()
    const lines = buf.split(/\r?\n/)
    buf = lines.pop()
    for (const line of lines) log(name, line)
  })
}

async function killTree(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return
  await new Promise((resolve) => {
    proc.once('exit', resolve)
    if (isWin) {
      spawnSync('taskkill', ['/pid', String(proc.pid), '/t', '/f'])
    } else {
      try {
        process.kill(-proc.pid, 'SIGTERM')
      } catch {
        proc.kill('SIGTERM')
      }
    }
  })
}

class Service {
  constructor(name, { command, args, cwd, shell = false }) {
    this.name = name
    this.command = command
    this.args = args
    this.cwd = cwd
    this.shell = shell
    this.proc = null
    this.stopping = false
  }

  start() {
    log(this.name, `iniciando: ${this.command} ${this.args.join(' ')}`)
    this.proc = spawn(this.command, this.args, {
      cwd: this.cwd,
      shell: this.shell,
      detached: !isWin,
    })
    pipe(this.name, this.proc.stdout)
    pipe(this.name, this.proc.stderr)
    this.proc.on('exit', (code, signal) => {
      if (this.stopping) return
      log(this.name, `processo encerrado (code=${code} signal=${signal})`)
    })
  }

  async restart(reason) {
    this.stopping = true
    log(this.name, `reiniciando (${reason})...`)
    await killTree(this.proc)
    this.stopping = false
    this.start()
  }

  async stop() {
    this.stopping = true
    await killTree(this.proc)
  }
}

const backend = new Service('backend', {
  command: pythonBin,
  args: ['-m', 'uvicorn', 'app.main:app', '--reload'],
  cwd: backendDir,
})

const frontend = new Service('frontend', {
  command: npmCmd,
  args: ['run', 'dev'],
  cwd: rootDir,
  // npm.cmd no Windows precisa de shell para ser executado diretamente.
  shell: isWin,
})

backend.start()
frontend.start()

// Debounce: editores costumam disparar varios eventos de fs por salvamento.
function watchEnv(path, service) {
  if (!existsSync(path)) return
  let timer = null
  watch(path, { persistent: true }, () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      service.restart(`${path} alterado`)
    }, 300)
  })
  log(service.name, `observando ${path}`)
}

watchEnv(join(backendDir, '.env'), backend)
watchEnv(join(rootDir, '.env'), frontend)

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  log('start-local', `recebido ${signal}, encerrando backend e frontend...`)
  await Promise.all([backend.stop(), frontend.stop()])
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
