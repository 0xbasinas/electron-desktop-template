import type { JSX } from 'react'

/** The web version of the product. Sign-in and real features arrive with the API. */
export function AppPage(): JSX.Element {
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold tracking-tight">Web app</h1>
      <p className="text-muted-foreground">
        The browser version of the app will live here. It shares its components and data model with
        the desktop app.
      </p>
    </div>
  )
}
