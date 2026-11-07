import path from 'node:path'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Tests run inside the real Workers runtime (workerd) with a real, empty D1 database per test file.
const migrations = await readD1Migrations(path.join(import.meta.dirname, 'drizzle'))

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: migrations,
          BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123'
        }
      }
    })
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
    include: ['test/**/*.test.ts', 'src/**/*.test.ts']
  }
})
