import { describe, expect, it } from 'vitest'
import { hintReceiptSchema } from '@/components/practice/session/session-api'

/** The platform hint receipt: `{ level, text, sourceLink }`; a teacher question's only rung is "look back at the source". */
describe('hint receipt (platform shape)', () => {
  it('keeps the look-back link of a teacher question', () => {
    const parsed = hintReceiptSchema.parse({ level: 1, text: 'Look back at the material your teacher shared for this topic.', sourceLink: { route: 'LIBRARY_ITEM', id: 'item-1', planId: null } })
    expect(parsed.sourceLink?.route).toBe('LIBRARY_ITEM')
  })
  it('a generated hint has no link', () => {
    expect(hintReceiptSchema.parse({ level: 2, text: 'Think about the first step.', sourceLink: null }).sourceLink).toBeNull()
    expect(hintReceiptSchema.parse({ level: 3, text: 'A similar example.' }).sourceLink).toBeNull()
  })
  it('refuses an unknown level', () => {
    expect(() => hintReceiptSchema.parse({ level: 4, text: 'x', sourceLink: null })).toThrow()
  })
})
