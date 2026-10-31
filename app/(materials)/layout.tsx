import { requireMaterialAccess } from '@/lib/auth/material-access'
import { MaterialIdentityProvider } from '@/components/materials/material-identity'
import { ChildMaterialShell } from '@/components/materials/child-material-shell'
import { StudentShell } from '@/components/shared/AppSidebar'

export default async function MaterialLayout({ children }: { children: React.ReactNode }) {
  const access = await requireMaterialAccess()
  return <MaterialIdentityProvider scope={access.scope}>{access.kind === 'child' ? <ChildMaterialShell band={access.band} nickname={access.nickname}>{children}</ChildMaterialShell> : <StudentShell profileSession={access.profileSession}>{children}</StudentShell>}</MaterialIdentityProvider>
}
