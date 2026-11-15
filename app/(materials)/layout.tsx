import { requireMaterialAccess } from '@/lib/auth/material-access'
import { MaterialIdentityProvider } from '@/components/materials/material-identity'
import { ChildMaterialShell } from '@/components/materials/child-material-shell'
import { StudentShell } from '@/components/shared/AppSidebar'
import { readTutorEntrySeed } from '@/components/tutor-loop/shell/eligibility'
import { TutorEntrySeedProvider } from '@/components/tutor-loop/shell/tutor-shell-context'

export default async function MaterialLayout({ children }: { children: React.ReactNode }) {
  const access = await requireMaterialAccess()
  const seed = await readTutorEntrySeed()
  return <MaterialIdentityProvider scope={access.scope}><TutorEntrySeedProvider seed={seed}>{access.kind === 'child' ? <ChildMaterialShell band={access.band} nickname={access.nickname}>{children}</ChildMaterialShell> : <StudentShell profileSession={access.profileSession}>{children}</StudentShell>}</TutorEntrySeedProvider></MaterialIdentityProvider>
}
