import { Resend } from 'resend'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

/** Anything that can send an email. Production uses Resend; tests and local development use the others. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The email that carries the sign-in link. Pure, so it is easy to test. */
export function magicLinkEmail(url: string, appName: string): Omit<EmailMessage, 'to'> {
  const safe = escapeHtml(url)
  return {
    subject: `Sign in to ${appName}`,
    text: `Use this link to sign in to ${appName}. It works once and expires in 5 minutes.\n\n${url}\n\nIf you did not ask for it, you can ignore this email.`,
    html: `<p>Use this link to sign in to ${escapeHtml(appName)}. It works once and expires in 5 minutes.</p><p><a href="${safe}">Sign in</a></p><p>If you did not ask for it, you can ignore this email.</p>`
  }
}

export function createResendSender(apiKey: string, from: string): EmailSender {
  const resend = new Resend(apiKey)
  return {
    async send({ to, subject, html, text }) {
      // The SDK returns { data, error } instead of throwing for API errors.
      const { error } = await resend.emails.send({ from, to: [to], subject, html, text })
      if (error) throw new Error(`Resend: ${error.name}: ${error.message}`)
    }
  }
}

/** For local development without a Resend key: prints the email so you can click the link. */
export function createConsoleSender(): EmailSender {
  return {
    async send({ to, subject, text }) {
      console.log(`\n--- email to ${to}: ${subject} ---\n${text}\n---`)
    }
  }
}
