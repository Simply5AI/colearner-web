import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { OrgSetupForm } from '@/components/teacher/org-setup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default async function TeacherOrgSetupPage() {
  const session = await auth()
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/teacher/org-setup')
  }

  if (session.user.roles?.includes('TEACHER')) {
    redirect('/teacher/dashboard')
  }

  const defaultDisplayName = `${session.user.name || 'My'}'s School`

  return (
    <TeacherPage
      title="Set up your teaching organization"
      subtitle="We'll create a 1-person organization and grant you the TEACHER role."
    >
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization details</CardTitle>
            <CardDescription>
              Choose how your school appears to students and collaborators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OrgSetupForm defaultDisplayName={defaultDisplayName} />
          </CardContent>
        </Card>
      </div>
    </TeacherPage>
  )
}