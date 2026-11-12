import { TeachingWorkspace } from '@/components/teacher/teaching-workspace'
import { TeacherPage } from '@/components/teacher/teacher-page'
import { CsvImportScreen } from '@/components/teacher/questions/csv-import-screen'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || null

export default async function TeacherQuestionImportPage({ searchParams }: { searchParams: Promise<{ planId?: string | string[]; importId?: string | string[] }> }) {
  const query = await searchParams
  return (
    <TeachingWorkspace>
      <TeacherPage title="Import questions" subtitle="Add many questions at once from a CSV file. They arrive as drafts for you to review.">
        <CsvImportScreen planId={first(query.planId)} importId={first(query.importId)} />
      </TeacherPage>
    </TeachingWorkspace>
  )
}
