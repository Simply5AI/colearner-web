import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const checklist = [
  { title: 'Create your first study plan', href: '/teacher/plans' },
  { title: 'Add materials to topics', href: '/teacher/plans' },
  { title: 'Build a question bank', href: '/teacher/plans' },
  { title: 'Invite students', href: '/teacher/plans' },
]

export default function TeacherOnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, teacher!</CardTitle>
          <CardDescription>
            Your TEACHER role is active. Here&apos;s a quick checklist to get your first class ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li key={item.title} className="flex items-center gap-3 rounded-lg border p-3">
                <CheckCircle2 className="h-5 w-5 text-brand-teal" />
                <span className="flex-1 text-sm font-medium">{item.title}</span>
                <Button asChild size="sm" variant="outline">
                  <Link href={item.href}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>

          <Button asChild className="w-full bg-brand-teal hover:bg-brand-teal/90">
            <Link href="/teacher/dashboard">Go to teacher dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}