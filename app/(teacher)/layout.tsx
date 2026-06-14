import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { TeacherShell } from '@/components/teacher/teacher-shell'

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.accessToken) {
    redirect('/login')
  }

  return (
    <TeacherShell teacherName={session.user.name}>
      {children}
    </TeacherShell>
  )
}