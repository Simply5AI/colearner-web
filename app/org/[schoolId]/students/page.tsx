import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { StudentsScreen } from '@/components/school/students-screen'
export default async function StudentsPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  await requireSchoolWorkspace(schoolId, ['SCHOOL_ADMIN'])
  return <StudentsScreen schoolId={schoolId} />
}
