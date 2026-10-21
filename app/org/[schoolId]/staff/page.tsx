import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { StaffScreen } from '@/components/school/staff-screen'
export default async function StaffPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  await requireSchoolWorkspace(schoolId, ['SCHOOL_ADMIN'])
  return <StaffScreen schoolId={schoolId} />
}
