import { useCallback, useEffect, useState, type FormEvent, type JSX } from 'react'
import { Button } from '@repo/ui'
import { authClient } from '../lib/auth'

interface Provider {
  providerId: string
  domain: string
  organizationId?: string | null
  domainVerified?: boolean
}

interface Pending {
  providerId: string
  domain: string
  token: string
}

/**
 * Set up a company's OpenID Connect sign-in, prove its domain with a DNS record, and remove it again. Staff see the
 * providers they made; with `organizationId` (a team owner or admin) the list and the new provider belong to that team.
 */
export function SsoAdminSection({ organizationId }: { organizationId?: string }): JSX.Element {
  const [providerId, setProviderId] = useState('')
  const [issuer, setIssuer] = useState('')
  const [domain, setDomain] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    void authClient.sso.providers().then(({ data }) => {
      if (cancelled) return
      const list = ((data as { providers?: Provider[] } | Provider[] | null) ?? []) as
        Provider[] | { providers?: Provider[] }
      const all = Array.isArray(list) ? list : (list.providers ?? [])
      setProviders(organizationId ? all.filter((p) => p.organizationId === organizationId) : all)
    })
    return () => {
      cancelled = true
    }
  }, [organizationId, reload])

  const refresh = useCallback(() => setReload((n) => n + 1), [])

  async function register(event: FormEvent): Promise<void> {
    event.preventDefault()
    setMessage(null)
    // The server reads the company's public settings from its issuer address, so nothing has to be typed or trusted
    // globally. The endpoints are then handed to the sign-in plugin directly.
    const lookup = await fetch(`/api/sso-discover?issuer=${encodeURIComponent(issuer.trim())}`, {
      credentials: 'same-origin'
    })
    if (!lookup.ok) {
      const failure = (await lookup.json().catch(() => null)) as { error?: string } | null
      setMessage(failure?.error ?? 'Could not read that issuer.')
      return
    }
    const found = (await lookup.json()) as {
      issuer: string
      authorizationEndpoint: string
      tokenEndpoint: string
      jwksEndpoint: string
      userInfoEndpoint?: string
      tokenEndpointAuthMethods: string[]
    }
    const method = found.tokenEndpointAuthMethods.includes('client_secret_basic')
      ? 'client_secret_basic'
      : found.tokenEndpointAuthMethods.includes('client_secret_post')
        ? 'client_secret_post'
        : undefined
    const { data, error } = await authClient.sso.register({
      providerId: providerId.trim(),
      issuer: found.issuer,
      domain: domain.trim().toLowerCase(),
      ...(organizationId ? { organizationId } : {}),
      oidcConfig: {
        clientId: clientId.trim(),
        clientSecret,
        scopes: ['openid', 'email', 'profile'],
        skipDiscovery: true,
        authorizationEndpoint: found.authorizationEndpoint,
        tokenEndpoint: found.tokenEndpoint,
        jwksEndpoint: found.jwksEndpoint,
        ...(found.userInfoEndpoint ? { userInfoEndpoint: found.userInfoEndpoint } : {}),
        ...(method ? { tokenEndpointAuthentication: method } : {})
      }
    })
    if (error || !data) {
      setMessage(error?.message ?? 'Could not add the provider.')
      return
    }
    setClientSecret('')
    setPending({
      providerId: providerId.trim(),
      domain: domain.trim().toLowerCase(),
      token: (data as { domainVerificationToken?: string }).domainVerificationToken ?? ''
    })
    refresh()
  }

  async function verify(id: string): Promise<void> {
    const { error } = await authClient.sso.verifyDomain({ providerId: id })
    setMessage(
      error
        ? 'The DNS record was not found yet. It can take a while to appear; try again later.'
        : 'Domain verified. People at this company can now sign in.'
    )
    refresh()
  }

  async function showRecord(id: string): Promise<void> {
    const { data, error } = await authClient.sso.requestDomainVerification({ providerId: id })
    const found = providers.find((p) => p.providerId === id)
    if (error || !found) {
      setMessage(error?.message ?? 'Could not get the DNS record.')
      return
    }
    setPending({
      providerId: id,
      domain: found.domain,
      token: (data as { domainVerificationToken?: string } | null)?.domainVerificationToken ?? ''
    })
  }

  async function remove(id: string): Promise<void> {
    if (
      !window.confirm(
        [
          'Remove this company sign-in?',
          'Everyone who signed in through it is signed out right now, and their company link is deleted. They can still sign in with an email link.',
          'Their accounts and their place in the team stay. If a directory sync added them, switch them off there; removing this sign-in does not remove anyone from the team.'
        ].join('\n\n')
      )
    )
      return
    const { error } = await authClient.sso.deleteProvider({ providerId: id })
    setMessage(error ? (error.message ?? 'Could not remove it.') : 'Removed.')
    setPending(null)
    refresh()
  }

  return (
    <section className="space-y-3" aria-label="Company sign-in">
      <h2 className="text-lg font-semibold">Company sign-in (OpenID Connect)</h2>
      {providers.length > 0 && (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {providers.map((p) => (
            <li key={p.providerId} className="flex items-center justify-between gap-2 p-3 text-sm">
              <span>
                {p.providerId} ({p.domain}){' '}
                <span className="text-muted-foreground">
                  {p.domainVerified ? 'domain proven' : 'domain not proven yet'}
                </span>
              </span>
              <span className="flex gap-2">
                {!p.domainVerified && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void showRecord(p.providerId)}
                    >
                      DNS record
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void verify(p.providerId)}>
                      Check
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => void remove(p.providerId)}>
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => void register(e)} className="grid max-w-md gap-2">
        {(
          [
            ['Provider name', providerId, setProviderId],
            ['Issuer URL', issuer, setIssuer],
            ['Email domain', domain, setDomain],
            ['Client ID', clientId, setClientId]
          ] as const
        ).map(([label, value, set]) => (
          <input
            key={label}
            aria-label={label}
            placeholder={label}
            value={value}
            onChange={(e) => set(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        ))}
        <input
          aria-label="Client secret"
          placeholder="Client secret"
          type="password"
          autoComplete="off"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit" variant="outline">
          Add provider
        </Button>
      </form>
      {pending && (
        <div role="status" className="space-y-2 rounded-md border border-border p-3 text-sm">
          <p>
            Add this DNS TXT record to prove {pending.domain} belongs to them:
            <br />
            <code className="break-all">
              _better-auth-token-{pending.providerId}.{pending.domain} = {pending.token}
            </code>
          </p>
          <Button variant="outline" size="sm" onClick={() => void verify(pending.providerId)}>
            Check the record
          </Button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-sm">
          {message}
        </p>
      )}
    </section>
  )
}
