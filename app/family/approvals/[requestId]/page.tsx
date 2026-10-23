import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { ApprovalDetail } from '@/components/family/approvals/approval-detail'
import { LoadingState } from '@/components/design-system'

export default async function FamilyApprovalDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  if (!/^[0-9a-zA-Z-]{1,100}$/.test(requestId)) redirect('/family/approvals')
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/family/approvals/${requestId}`)}`)
  return <Suspense fallback={<LoadingState />}><ApprovalDetail requestId={requestId} /></Suspense>
}
