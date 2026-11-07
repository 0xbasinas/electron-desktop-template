import { describe, expect, it } from 'vitest'
import { emailSchema, noteInputSchema } from './schemas'

describe('emailSchema', () => {
  it('trims and lower-cases', () => {
    expect(emailSchema.parse('  Me@Example.COM ')).toBe('me@example.com')
  })
  it('rejects things that are not emails', () => {
    expect(emailSchema.safeParse('nope').success).toBe(false)
    expect(emailSchema.safeParse('a@b').success).toBe(false)
  })
})

describe('noteInputSchema', () => {
  it('requires a title and defaults the body', () => {
    expect(noteInputSchema.parse({ title: ' Hi ' })).toEqual({ title: 'Hi', body: '' })
    expect(noteInputSchema.safeParse({ title: '   ' }).success).toBe(false)
  })
  it('limits the size', () => {
    expect(noteInputSchema.safeParse({ title: 'x'.repeat(121) }).success).toBe(false)
    expect(noteInputSchema.safeParse({ title: 'x', body: 'y'.repeat(10_001) }).success).toBe(false)
  })
})
