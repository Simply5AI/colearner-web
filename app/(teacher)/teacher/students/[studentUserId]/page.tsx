import Link from 'next/link'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { MasteryBadge } from '@/components/shared/MasteryBadge'
import { ScoreChip } from '@/components/shared/ScoreChip'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { planRosterFixtures } from '@/lib/fixtures/teacher-analytics'

export default async function TeacherStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentUserId: string }>
  searchParams: Promise<{ planId?: string }>
}) {
  const { studentUserId } = await params
  const { planId } = await searchParams

  const roster = planId ? (planRosterFixtures[planId] ?? []) : Object.values(planRosterFixtures).flat()
  const student = roster.find((entry) => entry.studentUserId === studentUserId)

  return (
    <TeacherPage
      title={student?.studentName ?? 'Student'}
      subtitle={student?.studentEmail ?? 'Per-student analytics (W6)'}
      actions={
        planId ? (
          <Button asChild variant="outline">
            <Link href={`/teacher/plans/${planId}/analytics`}>Back to plan analytics</Link>
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Topic progress</CardTitle>
          <CardDescription>Deep-dive view will load per-topic mastery from B7 APIs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {student ? (
            <>
              <ProgressBar value={student.progressPercent} label="Overall progress" />
              <div className="flex items-center gap-3">
                <MasteryBadge level={student.masteryLevel} />
                <ScoreChip score={student.lastExamScore ?? 0} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Student not found in roster fixtures.</p>
          )}
        </CardContent>
      </Card>
    </TeacherPage>
  )
}