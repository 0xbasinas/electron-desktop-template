import { useEffect, useState, type FormEvent, type JSX } from 'react'
import { Button } from '@repo/ui'
import type { Note } from '@repo/shared'
import { Navigate } from 'react-router'
import { api } from '../lib/api'
import { authClient } from '../lib/auth'

/** The web version of the product: a small notes app that shows the sign-in + API + database wiring. */
export function AppPage(): JSX.Element {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) return <p className="text-muted-foreground">Loading...</p>
  if (!session) return <Navigate to="/sign-in" replace />
  return <Notes email={session.user.email} />
}

function Notes({ email }: { email: string }): JSX.Element {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.notes
      .list()
      .then((list) => {
        if (!cancelled) setNotes(list)
      })
      .catch((e: unknown) => {
        console.error(e)
        if (!cancelled) setError('Could not load your notes.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function add(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!title.trim()) return
    try {
      const note = await api.notes.create({ title, body: '' })
      setNotes((current) => [note, ...(current ?? [])])
      setTitle('')
      setError(null)
    } catch (e) {
      console.error(e)
      setError('Could not save the note.')
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      await api.notes.remove(id)
      setNotes((current) => (current ?? []).filter((n) => n.id !== id))
    } catch (e) {
      console.error(e)
      setError('Could not delete the note.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Web app</h1>
        <p className="text-sm text-muted-foreground">Signed in as {email}</p>
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Write a note"
          maxLength={120}
          aria-label="New note"
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
        />
        <Button type="submit">Add</Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notes === null ? (
        <p className="text-muted-foreground">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {notes.map((note) => (
            <li key={note.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span>{note.title}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void remove(note.id)}
                aria-label={`Delete ${note.title}`}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
