'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button, Card, Checkbox, Input } from '@/components/design-system'
import type { FamilyChild, EffectivePolicy } from '@/lib/api/family'
import { FamilyFrame, FamilyFeedback, FamilyQueryState, useFamilyData, useFamilyAction } from './family-common'
import { PolicyForm, EffectivePolicyView } from './policy-form'
import { PicturePin } from './picture-pin'
import { ConversationAccess } from './conversation-access'
import { ApprovalsEntry } from './approvals/approvals-entry'

/** A teen (14-17) may learn from their own verified login. The guardian invites the teen's email; the teen accepts at /student-invite. */
function TeenLoginInvite({linkId,nickname}:{linkId:string;nickname:string|null}) {
  const [email,setEmail]=useState('')
  const invite=useFamilyAction()
  return <Card className="space-y-4" data-testid="teen-login-invite"><h2 className="text-xl font-bold">Invite {nickname??'your teen'} to sign in on their own</h2><p className="text-sm text-muted-foreground">We email a one-use invitation to the address you enter. They sign in with that email, verify it and accept. It links only this school profile. Under-14 children learn on your shared device instead.</p><form method="post" className="space-y-3" onSubmit={event=>{event.preventDefault();invite.mutate({path:`/family/guardian-links/${linkId}/student-login-invitations`,body:{email}},{onSuccess:()=>setEmail('')})}}><Input label="Teen learner email" type="email" required value={email} onChange={event=>setEmail(event.target.value)}/><Button type="submit" loading={invite.isPending}>Send personal login invitation</Button></form><FamilyFeedback pending={invite.isPending} error={invite.error} message={invite.isSuccess?'Invitation sent. Ask them to open the email and follow the link.':undefined}/></Card>
}

function ChildRestrictions({child}:{child:FamilyChild}) {
  const policy=useFamilyData<EffectivePolicy>(`/family/profiles/${child.profileId}/effective-policy`,!!child.profileId&&child.consentCurrent)
  const [withdraw,setWithdraw]=useState(false)
  const [password,setPassword]=useState('')
  const [recent,setRecent]=useState(false)
  const [pictures,setPictures]=useState<number[]>([])
  const action=useFamilyAction()
  return <div className="space-y-5"><Card className="space-y-4"><h2 className="text-xl font-bold">{child.nickname??'Verified child'}</h2><p className="text-sm text-muted-foreground">This child’s verified link is separate from every sibling’s. {child.schoolName??'Verified school profile'}.</p><p>{child.consentCurrent?'Consent is current.':'Consent needs review. Learning access stays closed.'}</p><Link href="/consent" className="ds-button ds-button-secondary">Review or renew consent</Link><Checkbox checked={withdraw} onChange={event=>setWithdraw(event.target.checked)} label="I understand that withdrawing consent immediately closes this child’s learning sessions."/><Button variant="secondary" disabled={!withdraw||!child.consentCurrent} loading={action.isPending} onClick={()=>action.mutate({path:`/family/guardian-links/${child.linkId}/consents`,method:'DELETE'},{onSuccess:()=>{setWithdraw(false);void policy.refetch()}})}>Withdraw this child’s consent</Button><FamilyFeedback pending={action.isPending} error={action.error}/></Card>
    {child.ageBand==='TEENS'&&child.profileId&&child.consentCurrent&&<TeenLoginInvite linkId={child.linkId} nickname={child.nickname}/>}
    {child.profileId&&child.consentCurrent&&<FamilyQueryState pending={policy.isPending} error={policy.error} retry={()=>void policy.refetch()}>{policy.data&&<><EffectivePolicyView policy={policy.data}/><ConversationAccess profileId={child.profileId} teen={policy.data.parentConversationAccess==='SUMMARIES'}/><PolicyForm key={`${child.profileId}-${policy.data.preferenceRevision}`} parent path={`/family/profiles/${child.profileId}/preferences`} revision={policy.data.preferenceRevision} initial={policy.data.preferences} onSaved={()=>void policy.refetch()}/><Card className="space-y-5"><h2 className="text-xl font-bold">Set or reset the picture PIN</h2><PicturePin value={pictures} onChange={setPictures} disabled={action.isPending}/><Input label="Your adult password to change this PIN" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/><Checkbox label="Use my recent sign-in instead (checked by the server)" checked={recent} onChange={event=>{setRecent(event.target.checked);setPassword('')}}/><Link href="/login?callbackUrl=/family" className="ds-button ds-button-ghost">Sign in again for a fresh verification</Link><Button disabled={pictures.length!==3||(!password&&!recent)} loading={action.isPending} onClick={()=>action.mutate({path:`/family/profiles/${child.profileId}/pin`,method:'PUT',body:{...(password?{password}:{}),pictures}},{onSuccess:()=>{setPassword('');setPictures([])}})}>Save new picture PIN</Button><p className="text-sm text-muted-foreground">Changing the PIN invalidates this child’s existing picture sessions.</p></Card></>}</FamilyQueryState>}
  </div>
}
export function FamilyScreen() {
  const search=useSearchParams()
  const [selected,setSelected]=useState(search.get('profileId')??'')
  const children=useFamilyData<{items:FamilyChild[]}>('/family/children')
  const active=children.data?.items.find(child=>child.linkId===selected||child.profileId===selected)??children.data?.items[0]
  return <FamilyFrame title="Your verified family" description="Review each child’s consent, school profile and effective restrictions. Learning progress and reports arrive in a later rollout."><div className="flex flex-wrap gap-3"><Link href="/consent" className="ds-button ds-button-primary">Add a child with a school invitation</Link><ApprovalsEntry/><Link href="/profiles" className="ds-button ds-button-secondary">Shared-device profile picker</Link><Link href="/workspaces" className="ds-button ds-button-ghost">School workspaces</Link></div><FamilyQueryState pending={children.isPending} error={children.error} retry={()=>void children.refetch()}>{children.data?.items.length===0?<Card className="space-y-4"><h2 className="text-xl font-bold">No verified children yet</h2><p>Ask the school for a guardian invitation for each child. Membership or matching email does not create a guardian relationship.</p></Card>:<><nav aria-label="Verified child profiles" className="flex flex-wrap gap-3">{children.data?.items.map((child,index)=><Button key={child.linkId} variant={active?.linkId===child.linkId?'primary':'secondary'} onClick={()=>setSelected(child.linkId)}>{child.nickname??`Verified child ${index+1}`} · {child.schoolName??'Verified school'} · {child.ageBand??'Setup needed'}</Button>)}</nav>{active&&<ChildRestrictions key={active.linkId} child={active}/>}</>}</FamilyQueryState></FamilyFrame>
}
