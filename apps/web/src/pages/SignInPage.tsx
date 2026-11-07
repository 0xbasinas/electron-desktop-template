import { useState, type FormEvent, type JSX } from 'react'
import { Button } from '@repo/ui'
import { emailSchema } from '@repo/shared'
import { Navigate, useSearchParams } from 'react-router'
import { authClient } from '../lib/auth'

type State = 'idle' | 'sending' | 'sent'

export function SignInPage(): JSX.Element {
  const { data: session } = authClient.useSession()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(
    params.get('error')
      ? 'That sign-in link did not work. It may have expired or been used already.'
      : null
  )

  if (session) return <Navigate to="/app" replace />

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) {
      setError('Enter a valid email address.')
      return
    }
    setError(null)
    setState('sending')
    const { error: failure } = await authClient.signIn.magicLink({
      email: parsed.data,
      callbackURL: '/app',
      errorCallbackURL: '/sign-in?error=link'
    })
    if (failure) {
      setState('idle')
      setError(
        failure.status === 429
          ? 'Too many tries. Wait a minute and try again.'
          : 'Could not send the link. Try again.'
      )
      return
    }
    setState('sent')
  }

  if (state === 'sent') {
    return (
      <div className="mx-auto max-w-sm space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a sign-in link to <strong>{email.trim()}</strong>. It works once and expires in 5
          minutes.
        </p>
        <Button variant="outline" onClick={() => setState('idle')}>
          Use a different email
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-4" noValidate>
      <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
      <p className="text-sm text-muted-foreground">
        Enter your email and we will send you a link. No password, and new accounts are created
        automatically.
      </p>
      <label className="block space-y-1 text-sm">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={state === 'sending'} className="w-full">
        {state === 'sending' ? 'Sending...' : 'Email me a sign-in link'}
      </Button>
    </form>
  )
}
