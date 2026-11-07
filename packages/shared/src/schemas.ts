import { z } from 'zod'

/** An email address, normalised the same way everywhere (trimmed, lower case). */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

/** What a client may send to create a note. */
export const noteInputSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().max(10_000).default('')
})

/** A note as the API returns it. Timestamps are ISO strings. */
export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

/** The signed-in person, as shown on the account page. */
export const accountSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string()
})

/** Everything we hold about a person (the "download my data" file). No tokens or secrets are included. */
export const accountExportSchema = z.object({
  exportedAt: z.string(),
  account: accountSchema,
  notes: z.array(noteSchema),
  sessions: z.array(
    z.object({
      createdAt: z.string(),
      expiresAt: z.string(),
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable()
    })
  )
})

/** Deleting an account needs the email typed again, so it cannot happen by a stray click or request. */
export const deleteAccountInputSchema = z.object({ confirmEmail: emailSchema })

export type NoteInput = z.infer<typeof noteInputSchema>
export type Note = z.infer<typeof noteSchema>
export type Account = z.infer<typeof accountSchema>
export type AccountExport = z.infer<typeof accountExportSchema>
