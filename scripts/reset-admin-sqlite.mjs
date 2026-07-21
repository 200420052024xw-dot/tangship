import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const dataDirectory = resolve(process.cwd(), 'server/data')
const databasePath = resolve(dataDirectory, 'admin-local.sqlite')
if (!databasePath.startsWith(`${dataDirectory}\\`) && !databasePath.startsWith(`${dataDirectory}/`)) {
  throw new Error(`Refusing to reset SQLite outside ${dataDirectory}`)
}

for (const suffix of ['', '-shm', '-wal']) {
  const target = `${databasePath}${suffix}`
  if (existsSync(target)) rmSync(target)
}
console.log(`Reset complete: ${databasePath}`)
console.log('Run pnpm dev:admin:local to recreate and seed the database.')
