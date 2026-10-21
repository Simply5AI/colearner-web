import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { SchoolShell } from '@/components/school/school-shell'
export default async function SchoolLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  const { workspace, session } = await requireSchoolWorkspace(schoolId, [
    'SCHOOL_ADMIN',
    'TEACHER',
  ])
  return (
    <SchoolShell workspace={workspace} identity={session.user.name}>
      {children}
    </SchoolShell>
  )
}
