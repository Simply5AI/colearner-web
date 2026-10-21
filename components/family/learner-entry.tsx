'use client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button, Card } from '@/components/design-system'
import { familyDeviceRequest } from '@/lib/api/family-browser'
import { FamilyError, type ChildContext } from '@/lib/api/family'
import { FamilyFrame, FamilyFeedback, FamilyQueryState, useFamilyData } from './family-common'
import Link from 'next/link'
import {familyPolicyReason} from '@/lib/utils/family-policy'
export function LearnerEntry() {
  const {data:session}=useSession()
  const [selected,setSelected]=useState('')
  const child = useQuery({ queryKey:['family-child-session'], queryFn:()=>familyDeviceRequest<ChildContext>('child'), retry:false, refetchInterval:30000 })
  const personalMode=!!session?.accessToken&&child.error instanceof FamilyError&&child.error.status===401
  const personal=useFamilyData<{items:(ChildContext&{schoolName:string})[]}>('/family/student/profiles',personalMode)
  const current=personalMode?personal.data?.items.find(profile=>profile.profileId===selected):child.data
  const leave = useMutation({mutationFn:()=>familyDeviceRequest('child','DELETE'),retry:false,onSuccess:()=>window.location.assign('/profiles')})
  return <FamilyFrame title={current?`Hello, ${current.nickname}`:'Your learning profile'} co description={personalMode?'Choose the school profile explicitly linked to your verified personal login.':'This is your child profile session. Parent account actions need a new grown-up sign-in.'}><FamilyQueryState pending={personalMode?personal.isPending:child.isPending} error={personalMode?personal.error:child.error} retry={()=>void (personalMode?personal.refetch():child.refetch())}>{personalMode&&<div className="space-y-4"><h2 className="font-bold">Choose your school profile</h2>{personal.data?.items.length===0&&<p>No eligible school profile is linked to this account. Ask your guardian or school for the exact invitation.</p>}<div className="flex flex-wrap gap-3">{personal.data?.items.map(profile=><Button key={profile.profileId} variant={selected===profile.profileId?'primary':'secondary'} onClick={()=>setSelected(profile.profileId)}>{profile.nickname} · {profile.schoolName}</Button>)}</div></div>}{current&&<Card key={current.profileId} className="space-y-5"><p className="font-semibold">{current.effectivePolicy.allowedNow?'Your profile and current consent are verified.':'Learning is restricted right now.'}</p><p>Time remaining today: {Math.floor(current.effectivePolicy.remainingSeconds/60)} minutes.</p><ul className="space-y-2">{current.effectivePolicy.reasons.map(reason=><li key={reason}>{familyPolicyReason(reason)}</li>)}</ul><p className="text-sm text-muted-foreground">Open your material library to import an allowed source and return to its saved processing state. Lessons and practice appear only after their own validated learning steps.</p>{current.effectivePolicy.allowedNow&&<Link href="/learn/library" className="ds-button ds-button-primary">Open my material library</Link>}</Card>}</FamilyQueryState><div className="flex flex-wrap gap-3">{!personalMode&&<Button variant="secondary" loading={leave.isPending} onClick={()=>leave.mutate()}>Switch profile or school</Button>}<Link href="/profiles" className="ds-button ds-button-ghost">Ask my grown-up</Link></div><FamilyFeedback pending={leave.isPending} error={leave.error}/></FamilyFrame>
}

