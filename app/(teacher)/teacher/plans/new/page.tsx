import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PlanCreateForm } from '@/components/teacher/plans/plan-create-form'
import { TeacherPage } from '@/components/teacher/teacher-page'

export default function TeacherPlanNewPage() {
  return (
    <TeacherPage
      title="New study plan"
      subtitle="Define the basics, then build your module and topic tree in the editor."
    >
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan details</CardTitle>
            <CardDescription>
              All plans start as drafts and remain private until you publish them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanCreateForm />
          </CardContent>
        </Card>
      </div>
    </TeacherPage>
  )
}