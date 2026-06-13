import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/config'
import { OrgSetupForm } from '@/components/teacher/org-setup-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function TeacherOrgSetupPage() {
  const session = await auth()
  if (!session?.accessToken) {
    redirect('/login?callbackUrl=/teacher/org-setup')
  }

  const defaultDisplayName = `${session.user.name}'s School`

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <Card>
        <CardHeader>
          <CardTitle>Set up your teaching organization</CardTitle>
          <CardDescription>
            We&apos;ll create a 1-person organization and grant you the TEACHER role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrgSetupForm defaultDisplayName={defaultDisplayName} />
        </CardContent>
      </Card>
    </div>
  )
}