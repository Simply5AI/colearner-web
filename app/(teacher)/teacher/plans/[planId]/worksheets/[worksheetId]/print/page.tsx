import { TeachingWorkspace } from '@/components/teacher/teaching-workspace'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { WorksheetDocument } from '@/components/teacher/worksheets/worksheet-document'

export default async function TeacherWorksheetprintPage({ params }: { params: Promise<{ planId: string; worksheetId: string }> }) {
  const { planId, worksheetId } = await params
  return (
    <TeachingWorkspace>
      <TeacherPage title="Print worksheet" subtitle="A4 student copy. No answers are on this page.">
        <WorksheetDocument planId={planId} worksheetId={worksheetId} mode="student" />
      </TeacherPage>
    </TeachingWorkspace>
  )
}
