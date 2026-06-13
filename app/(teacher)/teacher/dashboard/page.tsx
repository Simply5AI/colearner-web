import Link from 'next/link'
import { BookOpen, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function TeacherDashboardPage() {
  return (
    <TeacherPage
      title="Teacher dashboard"
      subtitle={formatDate()}
      actions={
        <Button asChild>
          <Link href="/teacher/plans">Create study plan</Link>
        </Button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Study plans</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active enrollments</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg progress</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Avg exam score</CardDescription>
            <CardTitle className="text-3xl">—</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-primary" />
            Your study plans
          </CardTitle>
          <CardDescription>
            Plan authoring screens (W2) will populate this grid once B2 APIs ship.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
            <p className="text-sm text-muted-foreground">No study plans yet.</p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/teacher/plans">Create your first plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Student snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar value={0} label="Class average progress" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Avg exam score</span>
              <ScoreChip score={0} />
            </div>
          </CardContent>
        </Card>
      </div>
    </TeacherPage>
  )
}