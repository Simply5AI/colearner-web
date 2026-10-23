import { Suspense } from 'react'
import { requireTeacherWorkspace } from '@/lib/auth/teacher-access'
import { TeachingProvider } from '@/components/teacher/teaching-context'
import { TeacherOnboardingView } from '@/components/teacher/onboarding/onboarding-flow'

export const dynamic = 'force-dynamic'

export default async function TeacherOnboardingPage() {
  // A navigation hint only. There is no self-promotion path: teacher access comes from a school invitation.
  const { workspace } = await requireTeacherWorkspace()
  return (
    <TeachingProvider schoolId={workspace.schoolId} schoolName={workspace.schoolName}>
      <Suspense>
        <TeacherOnboardingView />
      </Suspense>
    </TeachingProvider>
  )
}
