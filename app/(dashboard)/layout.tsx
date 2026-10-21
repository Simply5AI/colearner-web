import { StudentShell } from '@/components/shared/AppSidebar'
import { GlobalGamificationEvents } from '@/components/shared/global-gamification-events'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import {accountFamilyAccess,familyAccessRedirect} from '@/lib/auth/family-access'
import {FamilyAccessUnavailable} from '@/components/family/family-common'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Route groups do not form URL prefixes. Enforce the existing app gates here
  // as well as middleware, so every dashboard-group descendant is covered.
  const session = await auth()
  if (!session?.accessToken) redirect('/login?callbackUrl=/dashboard')
  if (session.user.systemRole === 'SUPER_ADMIN') redirect('/admin/login')
  if (session.user.roles?.includes('TEACHER')) redirect('/teacher/dashboard')
  let status
  try{status=await accountFamilyAccess(session.accessToken)}catch{return <FamilyAccessUnavailable/>}
  const gate=familyAccessRedirect(status)
  if(gate)redirect(gate)
  if (!session.user.onboardingCompleted) redirect('/onboarding/profile')
  return <>
    <StudentShell>{children}</StudentShell>
    <GlobalGamificationEvents />
  </>
}
