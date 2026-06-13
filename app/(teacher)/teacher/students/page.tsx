import Link from 'next/link'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default function TeacherStudentsPage() {
  return (
    <TeacherPage
      title="Students"
      subtitle="Manage enrollments and track learner progress across your study plans."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-primary" />
            Enrollment roster
          </CardTitle>
          <CardDescription>
            Student management screens (W5) will list enrolled learners, progress, and exam scores per
            plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No student roster yet. Publish a study plan and invite learners to see enrollments here.
            </p>
            <Button asChild className="mt-4" variant="outline">
              <Link href="/teacher/plans">Go to study plans</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </TeacherPage>
  )
}