import { requireLearnerAccess } from '@/lib/auth/learner-access'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { ChildLearnShell } from '@/components/learn/child-learn-shell'
import { StudentShell } from '@/components/shared/AppSidebar'

/** Route groups add no URL prefix and middleware does not cover their descendants, so every gate is repeated here. */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const access = await requireLearnerAccess()
  return <LearnIdentityProvider scope={access.scope} band={access.kind === 'child' ? access.band : null}>
    {access.kind === 'child' ? <ChildLearnShell band={access.band} nickname={access.nickname}>{children}</ChildLearnShell> : <StudentShell profileSession={access.profileSession}>{children}</StudentShell>}
  </LearnIdentityProvider>
}
