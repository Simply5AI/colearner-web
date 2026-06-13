import Link from 'next/link'
import { Plus } from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlans } from '@/lib/api/teacher-plans'
import { PlansListView } from '@/components/teacher/plans/plans-list-view'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'

export default async function TeacherPlansPage() {
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }
  const plans = await fetchTeacherPlans(headers)

  return (
    <TeacherPage
      title="Study plans"
      subtitle="Author and publish master study plans for your students."
      actions={
        <Button asChild>
          <Link href="/teacher/plans/new">
            <Plus className="h-4 w-4" />
            New plan
          </Link>
        </Button>
      }
    >
      <PlansListView initialPlans={plans} />
    </TeacherPage>
  )
}