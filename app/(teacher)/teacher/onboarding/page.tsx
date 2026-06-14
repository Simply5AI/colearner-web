import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'

const checklist = [
  { title: 'Create your first study plan', href: '/teacher/plans', detail: 'Outline topics and phases' },
  { title: 'Add materials to topics', href: '/teacher/plans', detail: 'Upload PDFs, links, or captures' },
  { title: 'Build your question bank', href: '/teacher/plans', detail: 'Author or import practice questions' },
  { title: 'Invite students', href: '/teacher/students', detail: 'Share invite codes or assign from your org' },
]

export default async function TeacherOnboardingPage() {
  const session = await auth()
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/teacher/onboarding')
  }

  if (!session.user.roles?.includes('TEACHER')) {
    redirect('/teacher/org-setup')
  }

  return (
    <TeacherPage
      title="Welcome, teacher"
      subtitle="Your TEACHER role is active. Use this checklist to launch your first class."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
          <CardDescription>
            You can return here any time from the teacher dashboard while you finish setup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-3">
            {checklist.map((item) => (
              <li
                key={item.title}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 p-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
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