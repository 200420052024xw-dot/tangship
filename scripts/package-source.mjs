import { mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const run = (args) => { const result = spawnSync('git', args, { encoding: 'utf8' }); if (result.status !== 0) throw new Error(result.stderr.trim() || 'Git command failed'); return result.stdout.trim() }
const status = run(['status', '--porcelain'])
if (status) throw new Error('工作区存在未提交修改，请提交或暂存处理后再打包')
const tracked = run(['ls-files']).split(/\r?\n/).filter(Boolean)
const forbidden = tracked.filter(file => /(^|\/)(\.env(\..+)?|node_modules|dist[^/]*|server\/data)(\/|$)|\.(db|log|session)$|-(wal|shm)$/.test(file) && !file.endsWith('.env.example'))
if (forbidden.length) throw new Error(`发现禁止进入交付包的跟踪文件：${forbidden.join(', ')}`)
const directory = resolve('releases'); mkdirSync(directory, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-'), target = resolve(directory, `tangship-source-${stamp}.zip`)
const archive = spawnSync('git', ['archive', '--format=zip', '-o', target, 'HEAD'], { stdio: 'inherit' })
if (archive.status !== 0) process.exit(archive.status || 1)
console.log(`Source package created: ${target}`)
