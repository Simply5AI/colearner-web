import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { ApiError } from '@/lib/api/client'
import { getRecallSessionState } from '@/lib/api/recall'
import { EnrolledRecallSession } from '@/components/student/enrolled-recall-session'

export const metadata: Metadata = {
  title: 'Study session | CoLearner',
}

export default async function EnrolledRecallPage({
  params,
}: {
  params: Promise<{ clonedPlanId: string; sessionId: string }>
}) {
  const { clonedPlanId, sessionId } = await params

  let headers: Record<string, string>
  try {
    headers = await getAuthHeaders()
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/api/auth/force-signout')
    }
    throw err
  }

  const state = await getRecallSessionState(headers, sessionId)

  return (
    <div className="p-7">
      <EnrolledRecallSession
        sessionId={sessionId}
        clonedPlanId={clonedPlanId}
        authHeaders={headers}
        mode={state.mode}
        timeLimitSec={state.timeLimitSec}
      />
    </div>
  )
}