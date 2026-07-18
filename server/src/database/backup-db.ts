import Database = require('better-sqlite3')
import { config as loadEnv } from 'dotenv'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, dirname, isAbsolute, resolve } from 'node:path'

for (const file of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '../.env.local')]) if (existsSync(file)) { loadEnv({ path: file }); break }
const configured = process.env.SQLITE_DB_PATH
if (!configured) throw new Error('SQLITE_DB_PATH is required')
const source = isAbsolute(configured) ? configured : resolve(process.cwd(), configured)
if (!existsSync(source)) throw new Error('SQLite database does not exist')
const backupRoot = process.env.SQLITE_BACKUP_DIR || './backups', directory = isAbsolute(backupRoot) ? backupRoot : resolve(process.cwd(), backupRoot)
mkdirSync(directory, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), target = resolve(directory, `${basename(source)}.${stamp}.backup`)
async function main() { const db = new Database(source, { readonly: true }); try { await db.backup(target) } finally { db.close() }; console.log(`SQLite backup created in ${dirname(target)}`) }
void main()
