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

  it('is a real, readable message: a button, a fallback address, the name and the expiry', () => {
    const m = magicLinkEmail('https://x.test/verify?token=abc', 'GoZap')
    expect(m.html).toContain('<!doctype html>')
    expect(m.html).toContain('>Sign in</a>')
    expect(m.html).toContain('Sign in to GoZap')
    expect(m.html).toContain('expires in 5 minutes')
    expect(m.html).toContain('>G</td>')
    expect(m.text).toContain('Sign in to GoZap')
    expect(m.text).toContain('https://x.test/verify?token=abc')
    expect(m.text).not.toContain('<')
  })
})
