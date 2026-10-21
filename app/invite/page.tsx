import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { InvitationEntry } from '@/components/school/invitation-entry'
export default async function InvitePage() {
  const session = await auth()
  if (!session?.accessToken || !session.user?.id)
    redirect('/login?callbackUrl=/invite')
  return <InvitationEntry />
}
