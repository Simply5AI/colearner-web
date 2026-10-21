import { describe, expect, it, vi } from 'vitest'
import { POST as transcript } from '@/app/api/transcript/route'
import { POST as article } from '@/app/api/article-text/route'

describe('B06 retired public source fetchers', () => {
  it.each([['transcript', transcript], ['article', article]] as const)('%s refuses the legacy bypass without reading a source', async (_name, handler) => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const response = await handler()
    expect(response.status).toBe(410)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toMatchObject({ code: 'LEGACY_SOURCE_ROUTE_RETIRED', importPath: '/learn/import' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
