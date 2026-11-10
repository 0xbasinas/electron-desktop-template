import { useEffect, useState, type JSX } from 'react'
import { Link } from 'react-router'
import { authClient } from '../lib/auth'
import { Menu, menuItem } from './Menu'

interface Team {
  id: string
  name: string
}

/** The active workspace: "Personal" (no team) or one of the teams the person belongs to. */
export function WorkspaceSwitcher(): JSX.Element {
  const { data: session } = authClient.useSession()
  const activeId = (session?.session as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId
  const me = session?.user.id
  const [teams, setTeams] = useState<Team[]>([])
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!me) return
    let cancelled = false
    void authClient.organization.list().then(({ data }) => {
      if (!cancelled) setTeams((data ?? []) as Team[])
    })
    return () => {
      cancelled = true
    }
  }, [me, reload])

  const active = teams.find((t) => t.id === activeId) ?? null

  async function pick(organizationId: string | null, close: () => void): Promise<void> {
    close()
    await authClient.organization.setActive({ organizationId })
    setReload((n) => n + 1)
  }

  const check = <span aria-hidden="true">✓</span>
  return (
    <Menu
      label="Switch workspace"
      trigger={
        <>
          <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold">
            {(active?.name ?? 'P').slice(0, 1).toUpperCase()}
          </span>
          <span className="max-w-40 truncate font-medium">{active?.name ?? 'Personal'}</span>
          <span aria-hidden="true" className="text-xs text-muted-foreground">
            ▾
          </span>
        </>
      }
    >
      {(close) => (
        <>
          <p className="px-3 py-1.5 text-xs text-muted-foreground">Workspaces</p>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={!active}
            className={menuItem}
            onClick={() => void pick(null, close)}
          >
            Personal {!active && check}
          </button>
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              role="menuitemradio"
              aria-checked={active?.id === t.id}
              className={menuItem}
              onClick={() => void pick(t.id, close)}
            >
              <span className="truncate">{t.name}</span> {active?.id === t.id && check}
            </button>
          ))}
          <div className="my-1 border-t border-border" />
          <Link role="menuitem" to="/teams" className={menuItem} onClick={close}>
            Manage teams
          </Link>
        </>
      )}
    </Menu>
  )
}
