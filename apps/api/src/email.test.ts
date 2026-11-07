import { describe, expect, it } from 'vitest'
import { magicLinkEmail } from './email'

describe('magicLinkEmail', () => {
  it('puts the link in both versions', () => {
    const m = magicLinkEmail('https://x.test/verify?token=abc&callbackURL=%2Fapp', 'My App')
    expect(m.subject).toBe('Sign in to My App')
    expect(m.text).toContain('https://x.test/verify?token=abc&callbackURL=%2Fapp')
    expect(m.html).toContain('href="https://x.test/verify?token=abc&amp;callbackURL=%2Fapp"')
  })

  it('escapes anything that could break out of the HTML', () => {
    const m = magicLinkEmail('https://x.test/"><script>alert(1)</script>', '<b>App</b>')
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<b>App</b>')
  })
})
