import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { StudentInvitation } from '@/components/family/student-invitation'
import { FamilyFrame } from '@/components/family/family-common'
export default async function StudentInvitePage(){const session=await auth();if(!session?.accessToken||!session.user?.id)return <FamilyFrame title="Accept your school login invitation" co description="Sign in with the invited email, then reopen your invitation email so its one-use code can be read on this device."><Link href="/login?callbackUrl=/student-invite" className="ds-button ds-button-primary">Sign in</Link><Link href="/signup?callbackUrl=/student-invite" className="ds-button ds-button-secondary">Create a minimal account</Link></FamilyFrame>;return <StudentInvitation/>}
