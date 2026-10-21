'use client'
import { schoolPath } from '@/lib/api/school'
import type { SchoolPolicy } from '@/lib/api/family'
import { SchoolHeading, useSchoolData, QueryState } from './school-common'
import { PolicyForm } from '@/components/family/policy-form'
export function SchoolPolicyScreen({schoolId}:{schoolId:string}) {
  const policy=useSchoolData<SchoolPolicy>(schoolId,'/learning-policy')
  return <div className="space-y-8"><SchoolHeading title="Learning & AI policies" description="Set school time, material, import, voice and group limits. Guardian consent and age rules can restrict them further."/><QueryState pending={policy.isPending} error={policy.error} retry={()=>void policy.refetch()}>{policy.data&&<PolicyForm key={policy.data.revision} path={schoolPath(schoolId,'/learning-policy')} revision={policy.data.revision} initial={policy.data.settings} packVersions={policy.data.availablePackVersions} onSaved={()=>void policy.refetch()}/>}</QueryState></div>
}
