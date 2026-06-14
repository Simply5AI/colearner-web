import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { TeacherSignupForm } from '@/components/teacher/teacher-signup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function TeacherSignupPage() {
  const session = await auth()

  if (session?.user?.roles?.includes('TEACHER')) {
    redirect('/teacher/dashboard')
  }

  if (session?.accessToken) {
    redirect('/dashboard')
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange">
          CoLearner for teachers
        </p>
        <h1 className="text-[28px] font-black leading-tight tracking-tight">Create teacher account</h1>
        <p className="text-[13px] text-muted-foreground">
          Teachers use a separate account from students. Sign up here to author study plans,
          share materials, and track class progress.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teacher registration</CardTitle>
          <CardDescription>
            We will create your teaching organization and grant the TEACHER role on this account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeacherSignupForm />
        </CardContent>
      </Card>
    </div>
  )
}