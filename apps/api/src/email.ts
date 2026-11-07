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

/**
 * The email that carries the sign-in link: a short, clean message with one button. Email clients ignore most CSS, so
 * the layout is a table with inline styles; there are no images (nothing to block), and the plain-text version says the
 * same. Pure, so it is easy to test.
 */
export function magicLinkEmail(url: string, appName: string): Omit<EmailMessage, 'to'> {
  const link = escapeHtml(url)
  const name = escapeHtml(appName)
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  return {
    subject: `Sign in to ${appName}`,
    text: [
      `Sign in to ${appName}`,
      '',
      'Open this link to sign in. It works once and expires in 5 minutes:',
      '',
      url,
      '',
      'If you did not ask to sign in, you can safely ignore this email. Nobody can sign in without the link.'
    ].join('\n'),
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Sign in to ${name}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your sign-in link for ${name}. It works once and expires in 5 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e7;">
<tr><td style="padding:32px 32px 8px;font-family:${font};font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#71717a;">${name}</td></tr>
<tr><td style="padding:0 32px;font-family:${font};font-size:22px;font-weight:600;line-height:1.3;color:#18181b;">Sign in to ${name}</td></tr>
<tr><td style="padding:12px 32px 24px;font-family:${font};font-size:15px;line-height:1.6;color:#3f3f46;">Click the button to sign in. The link works once and expires in 5 minutes.</td></tr>
<tr><td style="padding:0 32px 28px;"><a href="${link}" style="display:inline-block;background:#18181b;color:#ffffff;font-family:${font};font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:14px 24px;border-radius:8px;">Sign in</a></td></tr>
<tr><td style="padding:0 32px 8px;font-family:${font};font-size:13px;line-height:1.6;color:#71717a;">Button not working? Copy this address into your browser:</td></tr>
<tr><td style="padding:0 32px 28px;font-family:${font};font-size:12px;line-height:1.5;color:#52525b;word-break:break-all;">${link}</td></tr>
<tr><td style="padding:20px 32px 28px;border-top:1px solid #e4e4e7;font-family:${font};font-size:12px;line-height:1.6;color:#a1a1aa;">If you did not ask to sign in, you can safely ignore this email. Nobody can sign in without the link.</td></tr>
</table>
</td></tr></table>
</body></html>`
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
