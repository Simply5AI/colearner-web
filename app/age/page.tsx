import { auth } from '@/lib/auth/config'
import { AgeScreen } from '@/components/family/age-screen'
import { FamilyFrame } from '@/components/family/family-common'
import Link from 'next/link'
export default async function AgePage() {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) return <FamilyFrame title="Let’s find your starting point" co description="Sign in with your school account before checking your birthday. No child name or school details are collected here."><Link href="/login?callbackUrl=/age" className="ds-button ds-button-primary">Sign in to continue</Link><Link href="/signup?callbackUrl=/age" className="ds-button ds-button-secondary">Create a minimal account</Link></FamilyFrame>
  return <AgeScreen />
}
