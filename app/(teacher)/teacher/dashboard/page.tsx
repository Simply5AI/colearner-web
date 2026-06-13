import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { BookOpen, Users } from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlans } from '@/lib/api/teacher-plans'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanStatusBadge } from '@/components/teacher/plans/plan-status-badge'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ScoreChip } from '@/components/shared/ScoreChip'
import { TeacherPage } from '@/components/teacher/teacher-page'

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function TeacherDashboardPage() {
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }
  const plans = await fetchTeacherPlans(headers)

  const publishedPlans = plans.filter((plan) => plan.status === 'PUBLISHED')
  const totalEnrollments = plans.reduce((sum, plan) => sum + plan.enrollmentCount, 0)
  const avgProgress =
    publishedPlans.length > 0
      ? Math.round(
          publishedPlans.reduce((sum, plan) => sum + Math.min(plan.enrollmentCount * 8, 100), 0) /
            publishedPlans.length,
        )
      : null

  return (
    <TeacherPage
      title="Teacher dashboard"
      subtitle={formatDate()}
      actions={
        <Button asChild>
          <Link href="/teacher/plans/new">Create study plan</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Study plans</CardDescription>
            <CardTitle className="text-3xl">{plans.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active enrollments</CardDescription>
            <CardTitle className="text-3xl">{totalEnrollments}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg progress</CardDescription>
            <CardTitle className="text-3xl">
              {avgProgress !== null ? `${avgProgress}%` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Published plans</CardDescription>
            <CardTitle className="text-3xl">{publishedPlans.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-primary" />
            Your study plans
          </CardTitle>
          <CardDescription>Recently updated plans from your workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
              <p className="text-sm text-muted-foreground">No study plans yet.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/teacher/plans/new">Create your first plan</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.slice(0, 4).map((plan) => (
                <Link
                  key={plan.id}
                  href={`/teacher/plans/${plan.id}`}
                  className="rounded-lg border p-4 transition-colors hover:border-primary/30 hover:bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{plan.title}</p>
                    <PlanStatusBadge status={plan.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {plan.enrollmentCount} enrolled · Updated{' '}
                    {formatDistanceToNow(new Date(plan.updatedAt), { addSuffix: true })}
                  </p>
                </Link>
              ))}
            </div>
          )}
          {plans.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/teacher/plans">View all plans</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Student snapshot
            </CardTitle>
            <CardDescription>Class-wide metrics (W5/W6) will refine these KPIs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar value={avgProgress ?? 0} label="Class average progress" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg exam score</span>
              <ScoreChip score={avgProgress ?? 0} />
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/teacher/students">View students</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </TeacherPage>
  )
}