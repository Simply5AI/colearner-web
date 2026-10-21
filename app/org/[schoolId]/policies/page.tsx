import { requireSchoolWorkspace } from '@/lib/auth/school-access'
import { SchoolPolicyScreen } from '@/components/school/policy-screen'
export default async function PoliciesPage({params}:{params:Promise<{schoolId:string}>}) {const {schoolId}=await params;await requireSchoolWorkspace(schoolId,['SCHOOL_ADMIN']);return <SchoolPolicyScreen schoolId={schoolId}/>}
