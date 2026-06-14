import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { fetchTeacherPlans } from '@/lib/api/teacher-plans'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'


export default async function TeacherAnalyticsPage() {
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }
  const plans = await fetchTeacherPlans(headers)

  return (
    <TeacherPage
      title="Analytics"
      subtitle="Class-wide insights across your published study plans."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <CardTitle className="text-base">{plan.title}</CardTitle>
                <CardDescription>
                  {plan.enrollmentCount} enrolled · {plan.topicCount} topics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/plans/${plan.id}/analytics`}>View analytics</Link>
                </Button>
              </CardContent>
            </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Create and publish a study plan to see analytics.
          </CardContent>
        </Card>
      )}
    </TeacherPage>
  )
}