import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { fetchTeacherStudentRoster } from '@/lib/api/teacher-enrollments'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default async function TeacherStudentsPage() {
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  const roster = await fetchTeacherStudentRoster(headers)

  return (
    <TeacherPage
      title="Students"
      subtitle="Learners enrolled across your published study plans."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollment roster</CardTitle>
          <CardDescription>
            {roster.length} student{roster.length === 1 ? '' : 's'} enrolled in at least one plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No students enrolled yet. Publish a plan and share invite codes or assign learners
                from your organization.
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/teacher/plans">Go to study plans</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Plans</th>
                    <th className="px-4 py-3">Latest enrollment</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {roster.map((entry) => {
                    const latestPlan = entry.enrolledPlans[0]
                    return (
                      <tr key={entry.studentUserId} className="border-t">
                        <td className="px-4 py-3">
                          <p className="font-medium">{entry.studentName}</p>
                          <p className="text-xs text-muted-foreground">{entry.studentEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {entry.enrolledPlans.map((plan) => (
                              <p key={plan.planId} className="text-xs text-muted-foreground">
                                {plan.planTitle}
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {latestPlan
                            ? new Date(latestPlan.enrolledAt).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {latestPlan && (
                            <Button asChild size="sm" variant="ghost">
                              <Link
                                href={`/teacher/students/${entry.studentUserId}?planId=${latestPlan.planId}`}
                              >
                                View
                              </Link>
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </TeacherPage>
  )
}