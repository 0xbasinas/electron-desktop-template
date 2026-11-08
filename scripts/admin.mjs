// pnpm admin:grant <email> [admin|support]   |   pnpm admin:revoke <email>
// Local database by default; add --remote for the real one. The person must already have signed in once.
import { spawnSync } from 'node:child_process'
import { roleSql } from './admin-lib.mjs'

const argv = process.argv.slice(2)
const remote = argv.includes('--remote')
const [command, email, role] = argv.filter((a) => a !== '--remote')
let sql
try {
  sql = roleSql(command, email, role)
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
const result = spawnSync(
  'pnpm',
  [
    '--filter',
    '@repo/api',
    'exec',
    'wrangler',
    'd1',
    'execute',
    'DB',
    remote ? '--remote' : '--local',
    '--command',
    sql
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' }
)
process.exit(result.status ?? 1)
