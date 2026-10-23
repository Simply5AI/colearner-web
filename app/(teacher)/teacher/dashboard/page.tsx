import { requireTeacherWorkspace } from '@/lib/auth/teacher-access'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { TeacherDashboardView } from '@/components/teacher/dashboard/dashboard-view'

export const dynamic = 'force-dynamic'

export default async function TeacherDashboardPage() {
  // A navigation hint only: the platform authorises every /teaching call again.
  const { workspace } = await requireTeacherWorkspace()
  return (
    <TeachingProvider schoolId={workspace.schoolId} schoolName={workspace.schoolName}>
      <TeacherDashboardView />
    </TeachingProvider>
  )
}
