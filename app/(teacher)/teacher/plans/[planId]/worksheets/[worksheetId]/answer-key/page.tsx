import { TeachingWorkspace } from '@/components/teacher/teaching-workspace'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { WorksheetDocument } from '@/components/teacher/worksheets/worksheet-document'

export default async function TeacherWorksheetAnswerKeyPage({ params }: { params: Promise<{ planId: string; worksheetId: string }> }) {
  const { planId, worksheetId } = await params
  return (
    <TeachingWorkspace>
      <TeacherPage title="Teacher answer key" subtitle="For the teacher only. Print it separately from the student worksheet.">
        <WorksheetDocument planId={planId} worksheetId={worksheetId} mode="answer-key" />
      </TeacherPage>
    </TeachingWorkspace>
  )
}
