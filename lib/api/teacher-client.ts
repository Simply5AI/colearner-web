'use client'

import { ApiError } from '@/lib/api/client'
import type { FreelanceBootstrapPayload, FreelanceBootstrapResponse } from '@/lib/api/teacher'

async function teacherFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message ?? res.statusText)
  }

  return res.json() as Promise<T>
}

export function bootstrapFreelanceOrgClient(
  payload: FreelanceBootstrapPayload,
): Promise<FreelanceBootstrapResponse> {
  return teacherFetch<FreelanceBootstrapResponse>('/api/teacher/auth/freelance-bootstrap', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}