import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { AcademicsScreen } from '@/components/school/academics-screen'
export default async function AcademicsPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  await requireSchoolWorkspace(schoolId, ['SCHOOL_ADMIN'])
  return <AcademicsScreen schoolId={schoolId} />
}
