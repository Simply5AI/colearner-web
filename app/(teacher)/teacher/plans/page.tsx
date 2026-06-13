import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default function TeacherPlansPage() {
  return (
    <TeacherPage
      title="Study plans"
      subtitle="Author and publish master study plans for your students."
      actions={<Button disabled>New plan</Button>}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming in W2</CardTitle>
          <CardDescription>
            Plan list, editor, and tree authoring depend on TASK-12-B2 study plan APIs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/dev/ui">Preview shared UI primitives</Link>
          </Button>
        </CardContent>
      </Card>
    </TeacherPage>
  )
}