import { requireTeacherWorkspace } from '@/lib/auth/teacher-access'
import { TeachingProvider } from '@/components/teacher/teaching-context'

/**
 * Server wrapper shared by every teaching (B12) page. It verifies the selected school workspace
 * (a navigation hint only: the platform authorises every /teaching call again) and mounts
 * TeachingProvider for the client tree. Legacy-role pages (questions, enrollments, analytics,
 * students) do not use it.
 */
export async function TeachingWorkspace({ children }: { children: React.ReactNode }) {
  const { workspace } = await requireTeacherWorkspace()
  return (
    <TeachingProvider schoolId={workspace.schoolId} schoolName={workspace.schoolName}>
      {children}
    </TeachingProvider>
  )
}
