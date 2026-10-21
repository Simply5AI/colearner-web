import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { ConsentScreen } from '@/components/family/consent-screen'
import { FamilyFrame } from '@/components/family/family-common'
export default async function ConsentPage() {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id) return <FamilyFrame title="A grown-up’s help makes a safe start" co description="Sign in or create your own guardian account. You’ll verify your current email and your school-issued invitation before any child details are requested."><Link href="/login?callbackUrl=/consent" className="ds-button ds-button-primary">Parent or guardian sign in</Link><Link href="/signup?callbackUrl=/consent" className="ds-button ds-button-secondary">Create guardian account</Link></FamilyFrame>
  return <ConsentScreen/>
}
