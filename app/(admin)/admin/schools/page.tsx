import { requireAdminSession } from '@/lib/api/admin-session'
import { SchoolProvisioning } from '@/components/admin/school-provisioning'

export const metadata = { title: 'School provisioning | CoLearner' }
export default async function SchoolProvisioningPage() {
  await requireAdminSession()
  return <SchoolProvisioning />
}
