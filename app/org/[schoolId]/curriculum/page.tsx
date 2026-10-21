import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { CurriculumScreen } from '@/components/school/curriculum-screen'

export default async function CurriculumPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params
  await requireSchoolWorkspace(schoolId, ['SCHOOL_ADMIN'])
  return <CurriculumScreen schoolId={schoolId} />
}
