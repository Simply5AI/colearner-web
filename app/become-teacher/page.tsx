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
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          Teacher onboarding
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">Become a teacher</h1>
        <p className="text-[13px] text-muted-foreground">
          Create study plans, share materials, and track student progress on CoLearner.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary" />
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

        <Card className="border-primary/20 shadow-[0_0_0_1px_rgba(196,98,26,0.08)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GraduationCap className="h-5 w-5 text-primary" />
              Freelance teacher
            </CardTitle>
            <CardDescription>
              Auto-create a 1-person organization and start authoring immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/teacher/org-setup">Get started</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}