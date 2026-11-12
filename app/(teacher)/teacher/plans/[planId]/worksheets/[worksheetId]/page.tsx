import { TeachingWorkspace } from '@/components/teacher/teaching-workspace'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { WorksheetBuilder } from '@/components/teacher/worksheets/worksheet-builder'

export default async function TeacherWorksheetBuilderPage({ params }: { params: Promise<{ planId: string; worksheetId: string }> }) {
  const { planId, worksheetId } = await params
  return (
    <TeachingWorkspace>
      <TeacherPage title="Worksheet" subtitle="Choose questions, set marks, then print.">
        <WorksheetBuilder planId={planId} worksheetId={worksheetId} />
      </TeacherPage>
    </TeachingWorkspace>
  )
}
