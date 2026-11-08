import { describeDevice } from '@repo/shared'
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { recentAudit } from './audit'
import type { Db } from './db'
import { schema } from './db'
import { teamsOf } from './teams'

/**
 * What an AI app may do for a person who approved it: read their own account. Nothing here changes data, and every
 * query is limited to the person the token was issued to (never to an id the app supplies).
 */
function buildServer(db: Db, userId: string, appName: string): McpServer {
  const server = new McpServer({ name: appName, version: '1.0.0' })
  const reply = (value: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: { result: value }
  })
  const read = { readOnlyHint: true, destructiveHint: false, openWorldHint: false }

  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description: 'The name, email address and creation date of the signed-in account.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => {
      const [me] = await db
        .select({
          name: schema.user.name,
          email: schema.user.email,
          createdAt: schema.user.createdAt
        })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
      return reply(me ? { ...me, createdAt: me.createdAt.toISOString() } : null)
    }
  )

  server.registerTool(
    'list_teams',
    {
      title: 'List teams',
      description: 'The teams the account belongs to, with its role in each.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => reply(await teamsOf(db, userId))
  )

  server.registerTool(
    'list_devices',
    {
      title: 'List devices',
      description:
        'Where the account is signed in: one entry per device with when it was last used.',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => {
      const rows = await db
        .select({
          userAgent: schema.session.userAgent,
          createdAt: schema.session.createdAt,
          updatedAt: schema.session.updatedAt
        })
        .from(schema.session)
        .where(eq(schema.session.userId, userId))
      return reply(
        rows.map((r) => ({
          device: describeDevice(r.userAgent),
          signedInAt: r.createdAt.toISOString(),
          lastUsedAt: r.updatedAt.toISOString()
        }))
      )
    }
  )

  server.registerTool(
    'recent_security_activity',
    {
      title: 'Recent security activity',
      description: 'The latest sign-ins, failed attempts and account changes (newest first).',
      inputSchema: z.object({}),
      annotations: read
    },
    async () => reply(await recentAudit(db, userId))
  )

  return server
}

/** Answers one MCP request for the person the (already verified) token belongs to. Stateless; 2025-era traffic is refused. */
export function handleMcp(
  request: Request,
  db: Db,
  userId: string,
  appName: string
): Promise<Response> {
  const handler = createMcpHandler(() => buildServer(db, userId, appName), { legacy: 'reject' })
  return handler.fetch(request)
}
