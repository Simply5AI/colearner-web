import { requireLinkAccess } from '@/lib/auth/learner-access'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { ChildLearnShell } from '@/components/learn/child-learn-shell'
import { StudentShell } from '@/components/shared/AppSidebar'

/**
 * /learn/link must be reachable by a student who has no eligible profile yet, which the (learn) group's
 * family age/profile gate would redirect away. This group uses requireLinkAccess instead (no family-status
 * redirect, no onboarding redirect) and renders the same provider and shells. Nothing in (learn) is weakened.
 */
export default async function LearnLinkLayout({ children }: { children: React.ReactNode }) {
  const access = await requireLinkAccess()
  return <LearnIdentityProvider scope={access.scope} band={access.kind === 'child' ? access.band : null}>
    {access.kind === 'child' ? <ChildLearnShell band={access.band} nickname={access.nickname}>{children}</ChildLearnShell> : <StudentShell>{children}</StudentShell>}
  </LearnIdentityProvider>
}
