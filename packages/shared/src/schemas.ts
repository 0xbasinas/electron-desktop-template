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

export type NoteInput = z.infer<typeof noteInputSchema>
export type Note = z.infer<typeof noteSchema>
