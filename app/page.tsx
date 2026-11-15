import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { resolvePostLoginPath } from '@/lib/auth/post-login'
import { LandingPage } from '@/components/landing/landing-page'
import { schoolRequest, type CursorList, type Workspace } from '@/lib/api/school'
import {accountFamilyAccess,familyAccessRedirect} from '@/lib/auth/family-access'
import {FamilyAccessUnavailable} from '@/components/family/family-common'
export const metadata: Metadata = { title: 'CoLearner — Learning with Co', description: 'Meet Co, your AI study companion. Clear lessons, thoughtful questions and practice, with school and family guidance. Built around CBSE and ICSE learning.' }
export default async function HomePage() {
  const session = await auth()
  if (session?.accessToken && session.user?.id) {
    const memberships = await schoolRequest<CursorList<Workspace>>(session.accessToken, '/school-identity/workspaces')
    const active = memberships.items.filter((membership) => membership.status === 'ACTIVE')
    if (!memberships.nextCursor && active.length > 0 && active.every((membership) => membership.role === 'STUDENT')) redirect('/learner')
    if (memberships.items.length > 0) redirect('/workspaces')
    if(session.user.systemRole==='SUPER_ADMIN'||session.user.roles?.includes('TEACHER'))redirect(resolvePostLoginPath(session))
    let status
    try{status=await accountFamilyAccess(session.accessToken)}catch{return <FamilyAccessUnavailable/>}
    const gate=familyAccessRedirect(status)
    if(gate)redirect(gate)
    redirect(resolvePostLoginPath(session))
  }
  return <LandingPage />
}
