import { z } from 'zod'

/** How much of each kind of data we hold about the signed-in person (never the data itself). */
export const privacySummarySchema = z.object({
  devices: z.number(),
  signIns: z.number(),
  passkeys: z.number(),
  feedback: z.number(),
  hasSyncedSettings: z.boolean()
})

export type PrivacySummary = z.infer<typeof privacySummarySchema>
