import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { ApprovalsScreen } from '@/components/family/approvals/approvals-screen'
import { LoadingState } from '@/components/design-system'

export default async function FamilyApprovalsPage() {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) redirect('/login?callbackUrl=/family/approvals')
  return <Suspense fallback={<LoadingState />}><ApprovalsScreen /></Suspense>
}
