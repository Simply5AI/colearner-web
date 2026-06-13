import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2, GraduationCap } from 'lucide-react'
import { auth } from '@/lib/auth/config'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function BecomeTeacherPage() {
  const session = await auth()
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/become-teacher')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 p-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Become a teacher</h1>
        <p className="text-muted-foreground">
          Create study plans, share materials, and track student progress on CoLearner.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-brand-teal" />
              Institution
            </CardTitle>
            <CardDescription>
              Join your school or university organization with an invite code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" disabled className="w-full">
              Coming soon
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Institution onboarding ships after org-admin invite flows land in B1.
            </p>
          </CardContent>
        </Card>

        <Card className="border-brand-teal/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-brand-teal" />
              Freelance teacher
            </CardTitle>
            <CardDescription>
              Auto-create a 1-person organization and start authoring immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-brand-teal hover:bg-brand-teal/90">
              <Link href="/teacher/org-setup">Get started</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}