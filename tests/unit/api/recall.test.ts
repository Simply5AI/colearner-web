import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecallSession, getAttemptDiagnosis } from '@/lib/api/recall'
import { apiClient } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  apiClient: vi.fn(),
}))

const mockedApiClient = vi.mocked(apiClient)

describe('recall api client', () => {
  beforeEach(() => {
    mockedApiClient.mockReset()
  })

  it('sends availableMinutes when creating a recall session', async () => {
    mockedApiClient.mockResolvedValueOnce({ id: 'session-1' })

    await createRecallSession(
      { Authorization: 'Bearer token' },
      { questionCount: 10, availableMinutes: 25 },
    )

    expect(mockedApiClient).toHaveBeenCalledWith('/api/recall/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: { questionCount: 10, availableMinutes: 25 },
    })
  })

  it('fetches an attempt diagnosis by attempt id', async () => {
    mockedApiClient.mockResolvedValueOnce({ ready: false })

    await getAttemptDiagnosis({ Authorization: 'Bearer token' }, 'attempt-1')

    expect(mockedApiClient).toHaveBeenCalledWith(
      '/api/recall/attempts/attempt-1/diagnosis',
      { headers: { Authorization: 'Bearer token' } },
    )
  })
})
