import Database = require('better-sqlite3')
import { config as loadEnv } from 'dotenv'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, isAbsolute, resolve } from 'node:path'

for (const file of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '../.env.local')]) if (existsSync(file)) { loadEnv({ path: file }); break }
const sourceArg = process.argv[2], confirmed = process.argv.includes('--confirm')
if (!sourceArg || !confirmed) throw new Error('Usage: db:restore -- <backup-file> --confirm (stop the server first)')
const configured = process.env.SQLITE_DB_PATH
if (!configured) throw new Error('SQLITE_DB_PATH is required')
const source = resolve(sourceArg), target = isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
if (!existsSync(source)) throw new Error('Backup file does not exist')
mkdirSync(dirname(target), { recursive: true })
async function main() {
  if (existsSync(target)) { const safetyDir = resolve(dirname(target), '../backups'); mkdirSync(safetyDir, { recursive: true }); const current = new Database(target, { readonly: true }); try { await current.backup(resolve(safetyDir, `${basename(target)}.before-restore-${Date.now()}.backup`)) } finally { current.close() } }
  const backup = new Database(source, { readonly: true }); try { await backup.backup(target) } finally { backup.close() }
  const restored = new Database(target, { readonly: true }), integrity = restored.pragma('integrity_check', { simple: true }); restored.close()
  if (integrity !== 'ok') throw new Error('Restored database failed integrity_check')
  console.log('SQLite restore completed and integrity_check passed')
}
void main()
