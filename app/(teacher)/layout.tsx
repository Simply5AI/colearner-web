import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { TeacherShell } from '@/components/teacher/teacher-shell'
import { getTeacherWorkspace } from '@/lib/auth/teacher-access'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/teacher/dashboard')
  }

  const legacyRole = Boolean(session.user.roles?.includes('TEACHER'))
  // A school-approved teacher has no legacy role; a verified workspace is their only way in.
  const workspace = await getTeacherWorkspace()
  if (!legacyRole && !workspace) {
    redirect('/workspaces?denied=1')
  }

  return (
    <TeacherShell
      teacherName={session.user.name}
      schoolName={workspace?.schoolName}
      legacyRole={legacyRole}
    >
      {children}
    </TeacherShell>
  )
}
