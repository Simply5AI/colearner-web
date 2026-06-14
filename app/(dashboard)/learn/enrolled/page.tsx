import type { Metadata } from 'next'
import { EnrolledPlansList } from '@/components/student/enrolled-plans-list'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { fetchStudentEnrollments } from '@/lib/api/student-enrollments'

export const metadata: Metadata = {
  title: 'Enrolled Plans | CoLearner',
}

export default async function EnrolledPlansPage() {
  const headers = await getAuthHeaders()
  const enrollments = await fetchStudentEnrollments(headers)

  return (
    <div className="p-7">
      <EnrolledPlansList enrollments={enrollments} />
    </div>
  )
}