import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'

const checklist = [
  { title: 'Create your first study plan', href: '/teacher/plans' },
  { title: 'Add materials to topics', href: '/teacher/plans' },
  { title: 'Build a question bank', href: '/teacher/plans' },
  { title: 'Invite students', href: '/teacher/plans' },
]

export default function TeacherOnboardingPage() {
  return (
    <TeacherPage
      title="Welcome, teacher"
      subtitle="Your TEACHER role is active. Complete this checklist to get your first class ready."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
          <CardDescription>
            These steps unlock as plan authoring and enrollment APIs ship in TASK-12.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item.title} className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <span className="flex-1 text-sm font-medium">{item.title}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={item.href}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>

          <Button asChild className="w-full sm:w-auto">
            <Link href="/teacher/dashboard">Go to teacher dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </TeacherPage>
  )
}