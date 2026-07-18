import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const eslint = resolve('node_modules/eslint/bin/eslint.js')
const extensions = /\.(?:js|jsx|ts|tsx|css)$/
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(resolve(directory, entry.name)) : extensions.test(entry.name) ? [resolve(directory, entry.name)] : [])
const result = spawnSync(process.execPath, [eslint, ...walk(resolve('src')), ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
