import Link from 'next/link'
import { auth } from '@/lib/auth/config'
import { fetchStudentDetail } from '@/lib/api/teacher-analytics'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { MasteryBadge } from '@/components/shared/MasteryBadge'
import { ScoreChip } from '@/components/shared/ScoreChip'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function TeacherStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentUserId: string }>
  searchParams: Promise<{ planId?: string }>
}) {
  const { studentUserId } = await params
  const { planId } = await searchParams
  const session = await auth()
  const headers: Record<string, string> = {}
  if (session?.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`
  }

  const detail =
    planId && session?.accessToken
      ? await fetchStudentDetail(headers, studentUserId, planId)
      : null

  return (
    <TeacherPage
      title={detail?.profile.name ?? 'Student'}
      subtitle={detail?.profile.email ?? 'Per-student analytics'}
      actions={
        planId ? (
          <Button asChild variant="outline">
            <Link href={`/teacher/plans/${planId}/analytics`}>Back to plan analytics</Link>
          </Button>
        ) : undefined
      }
    >
      {!planId ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Select a plan from analytics to view student detail.
          </CardContent>
        </Card>
      ) : !detail ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Student not found in this plan roster.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
              <CardDescription>
                Enrolled {new Date(detail.profile.enrolledAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar value={detail.profile.progressPercent} label="Overall progress" />
              <div className="flex items-center gap-3">
                <MasteryBadge level={detail.profile.masteryLevel} />
                {detail.examHistory[0] && <ScoreChip score={detail.examHistory[0].score} />}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Topic progress</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.topicProgress.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published topics yet.</p>
              ) : (
                <div className="space-y-3">
                  {detail.topicProgress.map((topic) => (
                    <div
                      key={topic.topicId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{topic.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {topic.attempts} attempts
                          {topic.lastReviewed
                            ? ` · Last reviewed ${new Date(topic.lastReviewed).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <ProgressBar value={topic.correctPct} label="Coverage" className="w-32" />
                        <MasteryBadge level={topic.mastery} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Practice history</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.recallHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No practice sessions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.recallHistory.map((session) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>
                          {session.completedAt
                            ? new Date(session.completedAt).toLocaleString()
                            : 'In progress'}
                        </span>
                        <span className="font-medium">{session.accuracy}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exam history</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.examHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No exam attempts yet.</p>
                ) : (
                  <div className="space-y-2">
                    {detail.examHistory.map((session) => (
                      <div
                        key={session.sessionId}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>
                          {session.completedAt
                            ? new Date(session.completedAt).toLocaleString()
                            : 'In progress'}
                        </span>
                        <ScoreChip score={session.score} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </TeacherPage>
  )
}