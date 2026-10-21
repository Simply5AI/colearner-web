import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ session: vi.fn(), fetch: vi.fn() }))
vi.mock('next-auth/react', () => ({ getSession: mocks.session }))
vi.mock('@/lib/api/platform-client', () => ({ platformApiBaseUrl: () => 'https://platform.test/api/v1' }))
import { materialApi, materialConfigSchema, materialSchema } from '@/lib/api/materials'
import { materialRequest } from '@/lib/api/material-request'
const material = { id: 'm1', title: 'Source', sourceType: 'text', subjectId: null, subjectName: 'Science', planId: null, planTitle: null, createdAt: '2026-10-15', updatedAt: '2026-10-15', status: 'queued', stage: 'reading', progress: 0, jobId: 'j1', sourceVersionRef: null, concepts: [], error: null, links: { reader: null, lesson: null, practice: null }, actions: { retry: false, cancel: true, delete: true, addToPlan: true } }
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ accessToken: 'fresh-test-token', user: { id: 'learner-a' } }); vi.stubGlobal('fetch', mocks.fetch) })
describe('B06 material HTTP boundary', () => {
  it('posts ordered multipart files with metadata, leaving the browser to set its boundary', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { items: [material] } }), { status: 202 }))
    const files = [new File(['first'], 'first.pdf', { type: 'application/pdf' }), new File(['second'], 'second.pdf', { type: 'application/pdf' })]
    await materialApi.import({ idempotencyKey: 'batch-key', title: 'Pages', sourceType: 'pdf' }, files)
    const [url, request] = mocks.fetch.mock.calls[0]!
    expect(url).toBe('/api/materials/import')
    expect(request.headers).toEqual({})
    expect(request.body.getAll('files').map((file: File) => file.name)).toEqual(['first.pdf', 'second.pdf'])
    expect(JSON.parse(request.body.get('metadata'))).toEqual({ idempotencyKey: 'batch-key', title: 'Pages', sourceType: 'pdf' })
    expect(request.cache).toBe('no-store')
  })
  it('does not replay a mutation after 401 and omits sensitive server error text', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ message: 'secret private source body' }), { status: 401 }))
    await expect(materialApi.cancel('m1')).rejects.toThrow('Your learning session has ended.')
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })
  it('uses the cookie-bound BFF without exposing a browser bearer or account-only precheck', async () => {
    mocks.session.mockResolvedValue(null)
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { items: [material] } }), { status: 202 }))
    await materialApi.import({ idempotencyKey: 'child-cookie-key', title: 'Source', sourceType: 'text', text: 'Source text.' })
    expect(mocks.session).not.toHaveBeenCalled()
    expect(mocks.fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('Authorization')
  })
  it('rejects unsafe artifact links and unsupported response shapes', async () => {
    expect(materialSchema.safeParse({ ...material, links: { ...material.links, reader: 'javascript:alert(1)' } }).success).toBe(false)
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    await expect(materialRequest('/config', materialConfigSchema)).rejects.toThrow('unsupported response')
  })
  it('encodes filters and scoped record ids', async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { items: [], page: 1, limit: 20, total: 0 } }), { status: 200 }))
    await materialApi.list({ search: 'Water & soil', subjectId: 's1', page: 2 })
    expect(mocks.fetch.mock.calls[0]?.[0]).toContain('search=Water+%26+soil')
  })
})
