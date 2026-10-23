import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { TeacherDashboardHarness } from '@/components/teacher/dashboard/dev/dashboard-harness'

export default function TeacherDashboardDevPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return (
    <Suspense>
      <TeacherDashboardHarness />
    </Suspense>
  )
}
