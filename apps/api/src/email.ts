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

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace"
const ACCENT = '#4f46e5'

/**
 * The email that carries the sign-in link. Email clients ignore most CSS, so the layout is a table with inline
 * styles (plus a small <style> block for dark mode, which Apple Mail and most phones honour). There are no images:
 * the round logo is the first letter of the app name, so there is nothing for a client to block. The plain-text
 * version says the same. Pure, so it is easy to test.
 */
export function magicLinkEmail(url: string, appName: string): Omit<EmailMessage, 'to'> {
  const link = escapeHtml(url)
  const name = escapeHtml(appName)
  const initial = escapeHtml([...appName.trim()][0]?.toUpperCase() ?? '•')
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
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>Sign in to ${name}</title>
<style>
@media (prefers-color-scheme: dark) {
  .bg { background:#0b0b0f !important; }
  .card { background:#17171c !important; border-color:#2a2a33 !important; }
  .h, .brand { color:#f4f4f5 !important; }
  .p { color:#c4c4cc !important; }
  .muted { color:#8b8b96 !important; }
  .box { background:#0b0b0f !important; border-color:#2a2a33 !important; color:#c4c4cc !important; }
  .rule { border-color:#2a2a33 !important; }
}
</style></head>
<body class="bg" style="margin:0;padding:0;background:#f5f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your sign-in link for ${name}. It works once and expires in 5 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:#f5f5f7;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td align="center" style="padding:0 0 20px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;border-radius:10px;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:18px;font-weight:700;line-height:36px;text-align:center;" width="36" height="36">${initial}</td>
<td class="brand" style="padding-left:10px;font-family:${FONT};font-size:17px;font-weight:700;color:#18181b;">${name}</td>
</tr></table>
</td></tr>
<tr><td class="card" style="background:#ffffff;border:1px solid #e6e6eb;border-radius:16px;padding:36px 32px 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td class="h" style="font-family:${FONT};font-size:24px;font-weight:700;line-height:1.25;color:#18181b;padding-bottom:10px;">Sign in to ${name}</td></tr>
<tr><td class="p" style="font-family:${FONT};font-size:15px;line-height:1.6;color:#52525b;padding-bottom:28px;">Tap the button below and you are in. There is no password to remember.</td></tr>
<tr><td style="padding-bottom:12px;"><a href="${link}" style="display:block;background:${ACCENT};color:#ffffff;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;text-align:center;text-decoration:none;padding:16px 24px;border-radius:10px;">Sign in</a></td></tr>
<tr><td class="muted" style="font-family:${FONT};font-size:13px;line-height:1.5;color:#8b8b96;text-align:center;padding-bottom:28px;">This link works once and expires in 5 minutes.</td></tr>
<tr><td class="rule" style="border-top:1px solid #ececf0;padding-top:20px;font-family:${FONT};font-size:13px;line-height:1.5;color:#8b8b96;padding-bottom:8px;">Button not working? Paste this address into your browser:</td></tr>
<tr><td class="box" style="background:#f5f5f7;border:1px solid #e6e6eb;border-radius:8px;padding:10px 12px;font-family:${MONO};font-size:12px;line-height:1.5;color:#52525b;word-break:break-all;">${link}</td></tr>
</table>
</td></tr>
<tr><td class="muted" align="center" style="padding:20px 16px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#8b8b96;">If you did not ask to sign in, you can safely ignore this email.<br>Nobody can sign in without the link.</td></tr>
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
