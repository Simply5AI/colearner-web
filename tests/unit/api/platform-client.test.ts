// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { canonicalApiBaseUrl, CoLearnerApiError, CoLearnerClient } from '@colearner/api-client'

describe('portable v1 API client', () => {
  it('normalizes origin and canonical-prefix inputs consistently for auth/profile/logout adapters', () => {
    expect(canonicalApiBaseUrl('https://api.example.test/')).toBe('https://api.example.test/api/v1')
    expect(canonicalApiBaseUrl('https://api.example.test/api/v1')).toBe('https://api.example.test/api/v1')
    expect(() => canonicalApiBaseUrl('https://api.example.test/api')).toThrow()
  })
  const pair = { accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 }
  const response = (data: unknown, ok = true, status = 200) => ({ ok, status, json: async () => data })
  it('injects transport/header adapters and keeps canonical URLs stable across optional response fields', async () => {
    const transport = vi.fn().mockResolvedValue(response({ statusCode: 200, data: { ...pair, futureOptionalField: true }, timestamp: '2026-10-14T00:00:00Z' }))
    const client = new CoLearnerClient({ baseUrl: 'https://api.example.test/', transport, getHeaders: () => ({ 'x-org-id': 'school-1' }) })
    await expect(client.login({ email: 'user@example.test', password: 'supplied' })).resolves.toMatchObject(pair)
    expect(transport).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/login', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json', 'x-org-id': 'school-1' }, body: JSON.stringify({ email: 'user@example.test', password: 'supplied' }) }))
  })
  it('sends provider evidence, private refresh operation ids and validation credentials only in body/headers', async () => {
    const transport = vi.fn().mockResolvedValue(response(pair))
    const client = new CoLearnerClient({ baseUrl: 'https://api.example.test/api/v1', transport })
    await client.exchangeGoogle({ idToken: 'provider-evidence' })
    await client.refresh({ refreshToken: 'refresh', requestId: 'e7c48201-1393-4e55-aeca-e27d0d55e3d4' })
    transport.mockResolvedValue(response({ userId: 'user', orgId: 'school', sessionId: 'device' }))
    await client.validateSession('access', 'refresh')
    expect(transport.mock.calls.every(([url]) => !String(url).includes('?'))).toBe(true)
    expect(transport.mock.calls[2]?.[1]).toMatchObject({ headers: { Authorization: 'Bearer access' }, body: JSON.stringify({ refreshToken: 'refresh' }) })
  })
  it('preserves documented error status/code and rejects invalid success responses', async () => {
    const transport = vi.fn().mockResolvedValue(response({ statusCode: 401, message: 'Session revoked', code: 'REFRESH_REPLAY' }, false, 401))
    const client = new CoLearnerClient({ baseUrl: 'https://api.example.test', transport })
    await expect(client.refresh({ refreshToken: 'bad' })).rejects.toMatchObject({ status: 401, code: 'REFRESH_REPLAY', message: 'Session revoked' })
    for (const data of [{ ...pair, expiresIn: Infinity }, { ...pair, expiresIn: 0.5 }, { ...pair, refreshRequestId: 'invalid' }, { refreshToken: 'only-one' }]) {
      transport.mockResolvedValue(response(data))
      await expect(client.login({ email: 'u@e.test', password: 'p' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
    }
    transport.mockResolvedValue(response({ userId: '', orgId: 'org', sessionId: 'device' }))
    await expect(client.validateSession('a', 'r')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' })
  })
  it('handles network/JSON failures and injected aborts without exposing credentials', async () => {
    const transport = vi.fn().mockRejectedValue(new Error('private evidence should not leak'))
    const client = new CoLearnerClient({ baseUrl: 'https://api.example.test', transport })
    await expect(client.exchangeGoogle({ idToken: 'private' })).rejects.toMatchObject({ code: 'TRANSPORT_UNAVAILABLE', message: 'Could not reach CoLearner API' })
    transport.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error('bad-json') } })
    await expect(client.login({ email: 'u@e.test', password: 'p' })).rejects.toBeInstanceOf(CoLearnerApiError)
    const controller = new AbortController(); controller.abort()
    const aborted = new Error('aborted'); transport.mockRejectedValue(aborted)
    await expect(client.health(controller.signal)).rejects.toBe(aborted)
  })
})
