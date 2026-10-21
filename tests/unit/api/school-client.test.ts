import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/api/platform-client', () => ({
  platformApiBaseUrl: () => 'https://platform.test/api/v1',
}))
import { schoolRequest, schoolPath } from '@/lib/api/school'
describe('school API adapter', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('uses canonical v1 credentialed requests and existing envelope', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { items: [] } })))
    vi.stubGlobal('fetch', fetcher)
    expect(
      await schoolRequest(
        'session',
        schoolPath('school/a', '/classes'),
        'POST',
        { grade: 1 },
      ),
    ).toEqual({ items: [] })
    expect(fetcher).toHaveBeenCalledWith(
      'https://platform.test/api/v1/schools/school%2Fa/classes',
      expect.objectContaining({
        cache: 'no-store',
        method: 'POST',
        body: '{"grade":1}',
        headers: expect.objectContaining({ Authorization: 'Bearer session' }),
      }),
    )
  })
  it('refuses anonymous calls before sending', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(schoolRequest('', '/schools/a/classes')).rejects.toMatchObject(
      { status: 401 },
    )
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([400, 401, 403, 409, 503])(
    'handles %s without leaking backend account or provider details',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response('{"message":"secret@example.test database detail"}', {
            status,
          }),
        ),
      )
      await expect(
        schoolRequest('session', '/schools/a/classes'),
      ).rejects.toMatchObject({ status })
      try {
        await schoolRequest('session', '/schools/a/classes')
      } catch (error) {
        expect(String(error)).not.toContain('secret@example')
      }
    },
  )
  it('handles network outage as retryable draft-preserving failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    await expect(
      schoolRequest('session', '/schools/a/classes'),
    ).rejects.toMatchObject({ status: 503 })
  })
})
