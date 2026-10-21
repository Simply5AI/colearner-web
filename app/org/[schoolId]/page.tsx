import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { redirect } from 'next/navigation'
export default async function SchoolPage({
  params,
}: {
  params: Promise<{ schoolId: string }>
}) {
  const { schoolId } = await params
  const { workspace } = await requireSchoolWorkspace(schoolId, [
    'SCHOOL_ADMIN',
    'TEACHER',
  ])
  redirect(
    `/org/${encodeURIComponent(schoolId)}/${workspace.role === 'SCHOOL_ADMIN' ? 'academics' : 'classroom'}`,
  )
}
