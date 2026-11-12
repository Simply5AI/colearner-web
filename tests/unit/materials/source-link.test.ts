import { describe, expect, it } from 'vitest'
import { safeSourceUrl, sourceLabel, youtubeTimestampUrl } from '@/lib/materials/source-link'

describe('source-link', () => {
  it('labels a source by hostname without www', () => {
    expect(sourceLabel('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube.com')
    expect(sourceLabel('https://en.wikipedia.org/wiki/Cell')).toBe('en.wikipedia.org')
    expect(sourceLabel(null)).toBeNull()
    expect(sourceLabel('notes.pdf')).toBeNull()
  })
  it('only accepts plain http(s) links', () => {
    expect(safeSourceUrl('javascript:alert(1)')).toBeNull()
    expect(safeSourceUrl('https://example.org/a')).toBe('https://example.org/a')
  })
  it('builds YouTube timestamp links and returns null otherwise', () => {
    expect(youtubeTimestampUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 83_900)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=83s')
    expect(youtubeTimestampUrl('https://youtu.be/dQw4w9WgXcQ', 0)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0s')
    expect(youtubeTimestampUrl('https://example.org/watch?v=dQw4w9WgXcQ', 5000)).toBeNull()
    expect(youtubeTimestampUrl(null, 5000)).toBeNull()
  })
})
