'use client'

import { ApiError } from '@/lib/api/client'
import type { TeacherEnrollment, TeacherInviteCode } from '@/lib/fixtures/teacher-enrollments'

async function enrollmentsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function listPlanEnrollmentsClient(planId: string): Promise<TeacherEnrollment[]> {
  return enrollmentsFetch(`/api/teacher/plans/${planId}/enrollments`)
}

export function listPlanInviteCodesClient(planId: string): Promise<TeacherInviteCode[]> {
  return enrollmentsFetch(`/api/teacher/plans/${planId}/invite-codes`)
}

export function createInviteCodeClient(
  planId: string,
  body: { maxUses: number; expiresAt: string | null },
): Promise<TeacherInviteCode> {
  return enrollmentsFetch(`/api/teacher/plans/${planId}/invite-codes`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function revokeInviteCodeClient(planId: string, inviteId: string): Promise<TeacherInviteCode> {
  return enrollmentsFetch(`/api/teacher/plans/${planId}/invite-codes/${inviteId}/revoke`, {
    method: 'POST',
  })
}

export function redeemInviteCodeClient(code: string): Promise<{ planId: string; enrollmentId: string }> {
  return enrollmentsFetch('/api/student/enrollments/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}