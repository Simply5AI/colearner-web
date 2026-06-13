import Link from 'next/link'
import { BookOpen, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { ScoreChip } from '@/components/shared/ScoreChip'

export default function TeacherDashboardPage() {
  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teacher dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your plans and student activity.
          </p>
        </div>
        <Button asChild className="bg-brand-teal hover:bg-brand-teal/90">
          <Link href="/teacher/plans">Create study plan</Link>
        </Button>
      </div>

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
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Your study plans
          </CardTitle>
          <CardDescription>
            Plan authoring screens (W2) will populate this grid once B2 APIs ship.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed p-8 text-center">
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
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
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
    </div>
  )
}