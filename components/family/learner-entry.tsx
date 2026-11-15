'use client'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button, Card } from '@/components/design-system'
import { familyDeviceRequest } from '@/lib/api/family-browser'
import { FamilyError, type ChildContext } from '@/lib/api/family'
import { FamilyFrame, FamilyFeedback, FamilyQueryState, useFamilyData } from './family-common'
import Link from 'next/link'
import { selectLearnerSchool } from '@/app/workspaces/actions'
import { SignedInAs } from './signed-in-as'
import {familyPolicyReason} from '@/lib/utils/family-policy'
export function LearnerEntry({ homeHref = '/learn/home' }: { homeHref?: '/learn/home' | '/learn/start' }) {
  const {data:session}=useSession()
  const [selected,setSelected]=useState('')
  const child = useQuery({ queryKey:['family-child-session'], queryFn:()=>familyDeviceRequest<ChildContext>('child'), retry:false, refetchInterval:30000 })
  const personalMode=!!session?.accessToken&&child.error instanceof FamilyError&&child.error.status===401
  const personal=useFamilyData<{items:(ChildContext&{schoolName:string})[];sharedDeviceOnly?:{nickname:string;schoolName:string}[]}>('/family/student/profiles',personalMode)
  const current=personalMode?personal.data?.items.find(profile=>profile.profileId===selected):child.data
  const enter=useMutation({mutationFn:selectLearnerSchool,retry:false,onSuccess:result=>{if(result.href)window.location.assign(result.href)}})
  const leave = useMutation({mutationFn:()=>familyDeviceRequest('child','DELETE'),retry:false,onSuccess:()=>window.location.assign('/profiles')})
  return <FamilyFrame title={current?`Hello, ${current.nickname}`:'Your learning profile'} co description={personalMode?'Pick your school to start learning.':'This is your learning profile. A grown-up needs to sign in again for family settings.'}><FamilyQueryState pending={personalMode?personal.isPending:child.isPending} error={personalMode?personal.error:child.error} retry={()=>void (personalMode?personal.refetch():child.refetch())}>{personalMode&&<div className="space-y-4"><SignedInAs/>{(personal.data?.items.length??0)>0&&<h2 className="font-bold">Pick your school</h2>}{personal.data?.items.length===0&&((personal.data?.sharedDeviceOnly?.length??0)>0?<SharedDeviceOnly profiles={personal.data!.sharedDeviceOnly!}/>:<Card data-testid="no-learner-profile" className="space-y-3"><h2 className="text-xl font-bold">No learner profile is linked to this account</h2><p>This account has no school learner profile that is ready to use. A learner profile exists once a parent or guardian is linked to the school record and has given consent.</p><p>Learners: ask your parent, guardian or school office to check that your record is linked and consent is on. Parents and guardians: manage children from your family area.</p><div className="flex flex-wrap gap-3"><Link href="/family" className="ds-button ds-button-secondary">My verified family</Link><Link href="/workspaces" className="ds-button ds-button-ghost">My workspaces</Link></div></Card>)}<div className="flex flex-wrap gap-3">{personal.data?.items.map(profile=><Button key={profile.profileId} variant={selected===profile.profileId?'primary':'secondary'} onClick={()=>{setSelected(profile.profileId);enter.mutate(profile.schoolId)}}>{profile.nickname} · {profile.schoolName}</Button>)}</div></div>}{current&&<Card key={current.profileId} className="space-y-5"><p className="font-semibold">{current.effectivePolicy.allowedNow?'You are all set to learn.':'Learning is restricted right now.'}</p><p>Time remaining today: {Math.floor(current.effectivePolicy.remainingSeconds/60)} minutes.</p><ul className="space-y-2">{current.effectivePolicy.reasons.map(reason=><li key={reason}>{familyPolicyReason(reason)}</li>)}</ul><p className="text-sm text-muted-foreground">Add something to learn in your library, then try a lesson and some practice.</p>{current.effectivePolicy.allowedNow&&<div className="flex flex-wrap gap-3"><Link href={homeHref} className="ds-button ds-button-primary">{homeHref === '/learn/start' ? 'Start learning' : 'Go to my home'}</Link><Link href="/learn/library" className="ds-button ds-button-secondary">Open my library</Link></div>}</Card>}</FamilyQueryState><div className="flex flex-wrap gap-3">{!personalMode&&<Button variant="secondary" loading={leave.isPending} onClick={()=>leave.mutate()}>Switch profile or school</Button>}{!personalMode&&<Link href="/profiles" className="ds-button ds-button-ghost">Ask my grown-up</Link>}</div><FamilyFeedback pending={leave.isPending||enter.isPending} error={leave.error??(enter.data?.error?new Error(enter.data.error):enter.error)}/></FamilyFrame>
}


function SharedDeviceOnly({ profiles }: { profiles: { nickname: string; schoolName: string }[] }) {
  const names = profiles.map(profile => `${profile.nickname} (${profile.schoolName})`).join(', ')
  return <Card data-testid="shared-device-only" className="space-y-5">
    <h2 className="text-2xl font-bold">You learn on your grown-up’s device</h2>
    <p>Your learning profile is ready: {names}. For learners under 14, CoLearner opens it from a parent or guardian’s device instead of from your own login, so a grown-up stays in charge. You have not done anything wrong.</p>
    <div><p className="font-semibold">Ask your parent or guardian to:</p>
      <ol className="mt-2 list-decimal space-y-2 ps-6">
        <li>Sign in to CoLearner with their own account and open <strong>My verified family</strong> (<code>/family</code>).</li>
        <li>Choose your profile and set your picture PIN (three pictures you will remember).</li>
        <li>Open <strong>Shared device</strong> (<code>/profiles</code>), enter their password to enrol the device, and hand it to you.</li>
        <li>Pick your name, tap your three pictures, and start learning.</li>
      </ol></div>
    <p className="text-sm text-muted-foreground">You can sign out of this account now. If you need to start again later, your grown-up repeats steps 3 and 4.</p>
  </Card>
}
