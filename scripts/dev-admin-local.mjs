import { spawn, spawnSync } from 'node:child_process'

const command = 'pnpm'
const environment = { ...process.env, NODE_ENV: 'development' }
const children = [
  spawn(command, ['--filter', 'server', 'dev'], { cwd: process.cwd(), env: environment, stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn(command, ['--filter', 'admin-web', 'dev'], { cwd: process.cwd(), env: environment, stdio: 'inherit', shell: process.platform === 'win32' }),
]

let stopping = false
const stop = (code = 0) => {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.killed) continue
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    else child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 250)
}

for (const child of children) {
  child.on('error', error => { console.error(error); stop(1) })
  child.on('exit', code => { if (!stopping) stop(code || 0) })
}
process.on('SIGINT', () => stop(0))
process.on('SIGTERM', () => stop(0))

console.log('Local admin: http://localhost:5174/admin/')
