'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button, Card, Input } from '@/components/design-system'
import { FamilyFrame, FamilyFeedback, useFamilyData, useFamilyAction, FamilyQueryState } from './family-common'
import { useFragmentCode } from './fragment-code'
export function StudentInvitation() {
  const [token,setToken]=useFragmentCode('token')
  const [verification,setVerification]=useState('')
  const identity=useFamilyData<{email:string;emailVerified:boolean}>('/school-identity/profile')
  const action=useFamilyAction()
  const accept=useFamilyAction()
  return <FamilyFrame title="Your own school login" co description="Use the account whose verified email matches the invitation. This links only the school roster profile named by that invitation; it never merges accounts."><FamilyQueryState pending={identity.isPending} error={identity.error} retry={()=>void identity.refetch()}><Card className="space-y-4"><p className="break-words">Signed in as {identity.data?.email}</p>{!identity.data?.emailVerified&&<><p>Verify your current account email first.</p><Button loading={action.isPending} onClick={()=>action.mutate({path:'/school-identity/email-verification/request',body:{}})}>Send verification email</Button><form method="post" className="space-y-4" onSubmit={event=>{event.preventDefault();action.mutate({path:'/school-identity/email-verification/confirmation',body:{token:verification}},{onSuccess:()=>void identity.refetch()})}}><Input label="Email verification code" value={verification} onChange={event=>setVerification(event.target.value)} required/><Button type="submit" loading={action.isPending}>Verify current email</Button></form><FamilyFeedback pending={action.isPending} error={action.error}/></>}<form method="post" className="space-y-4" onSubmit={event=>{event.preventDefault();accept.mutate({path:'/family/student-login-invitations/accept',body:{token}},{onSuccess:()=>setToken('')})}}><Input label="Student login invitation code" autoComplete="off" value={token} onChange={event=>setToken(event.target.value)} required/><Button type="submit" loading={accept.isPending} disabled={!identity.data?.emailVerified||accept.isSuccess}>Accept my school profile login</Button></form><FamilyFeedback pending={accept.isPending} error={accept.error} message={accept.isSuccess?'Your verified login is now bound to the school profile. Continue to your age-checked school entry.':undefined}/>{accept.isSuccess&&<Link href="/learner" className="ds-button ds-button-primary">Continue to my school profile</Link>}</Card></FamilyQueryState></FamilyFrame>
}
