import { requireLearnerAccess } from '@/lib/auth/learner-access'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { ChildLearnShell } from '@/components/learn/child-learn-shell'
import { StudentShell } from '@/components/shared/AppSidebar'
import { readTutorEntrySeed } from '@/components/tutor-loop/shell/eligibility'
import { TutorEntrySeedProvider } from '@/components/tutor-loop/shell/tutor-shell-context'

/** Route groups add no URL prefix and middleware does not cover their descendants, so every gate is repeated here. */
export default async function LearnLayout({ children }: { children: React.ReactNode }) {
  const access = await requireLearnerAccess()
  // TUTOR W5: the shell learns from the server whether Tutor Loop is on, so the header never switches after first paint.
  const seed = await readTutorEntrySeed()
  return <LearnIdentityProvider scope={access.scope} band={access.kind === 'child' ? access.band : null}>
    <TutorEntrySeedProvider seed={seed}>
      {access.kind === 'child' ? <ChildLearnShell band={access.band} nickname={access.nickname}>{children}</ChildLearnShell> : <StudentShell profileSession={access.profileSession}>{children}</StudentShell>}
    </TutorEntrySeedProvider>
  </LearnIdentityProvider>
}
