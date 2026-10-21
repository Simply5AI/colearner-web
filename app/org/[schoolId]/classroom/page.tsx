import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { ClassroomScreen } from '@/components/school/classroom-screen'
export default async function ClassroomPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  await requireSchoolWorkspace(schoolId, ['TEACHER'])
  return <ClassroomScreen schoolId={schoolId} />
}
