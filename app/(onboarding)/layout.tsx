import type { Metadata } from 'next'
import {auth} from '@/lib/auth/config'
import {redirect} from 'next/navigation'
import {accountFamilyAccess,familyAccessRedirect} from '@/lib/auth/family-access'
import {FamilyAccessUnavailable} from '@/components/family/family-common'

export const metadata: Metadata = {
  title: {
    template: '%s | CoLearner Setup',
    default: 'Setup | CoLearner',
  },
}

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session=await auth()
  if(!session?.accessToken||!session.user?.id)redirect('/login?callbackUrl=/age')
  if(session.user.systemRole==='SUPER_ADMIN')redirect('/admin/login')
  if(session.user.roles?.includes('TEACHER'))redirect('/teacher/dashboard')
  let status
  try{status=await accountFamilyAccess(session.accessToken)}catch{return <FamilyAccessUnavailable/>}
  const gate=familyAccessRedirect(status)
  if(gate)redirect(gate)
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
