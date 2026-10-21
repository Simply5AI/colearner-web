'use client'
import { useState } from 'react'
import { schoolPath } from '@/lib/api/school'
import type { SchoolPolicy } from '@/lib/api/family'
import { SchoolHeading, useSchoolData, QueryState } from './school-common'
import { PolicyForm } from '@/components/family/policy-form'
export function SchoolPolicyScreen({schoolId}:{schoolId:string}) {
  const policy=useSchoolData<SchoolPolicy>(schoolId,'/learning-policy')
  const [saved,setSaved]=useState(false)
  return <div className="space-y-8"><SchoolHeading title="Learning & AI policies" description="Set school time, material, import, voice, group, Ask Co and homework help limits. Guardian consent and age rules can restrict them further."/><QueryState pending={policy.isPending} error={policy.error} retry={()=>void policy.refetch()}>{saved&&<p role="status" className="rounded-xl border p-4">School rules saved. The new limits apply to the next learner action.</p>}{policy.data&&<PolicyForm key={policy.data.revision} path={schoolPath(schoolId,'/learning-policy')} revision={policy.data.revision} initial={policy.data.settings} packVersions={policy.data.availablePackVersions} onSaved={()=>{setSaved(true);void policy.refetch()}}/>}</QueryState></div>
}
