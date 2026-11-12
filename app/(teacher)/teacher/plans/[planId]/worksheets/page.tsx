import { TeachingWorkspace } from '@/components/teacher/teaching-workspace'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { WorksheetsList } from '@/components/teacher/worksheets/worksheets-list'

export default async function TeacherWorksheetsPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params
  return (
    <TeachingWorkspace>
      <TeacherPage title="Worksheets" subtitle="Printable A4 sheets from your published questions.">
        <WorksheetsList planId={planId} />
      </TeacherPage>
    </TeachingWorkspace>
  )
}
