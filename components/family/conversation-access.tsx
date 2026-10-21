'use client'
import {useState} from 'react'
import type {FamilyConversationAccess,FamilySafetyGrant} from '@colearner/api-client'
import {Button,Card,Input,Checkbox} from '@/components/design-system'
import {FamilyFeedback,FamilyQueryState,useFamilyAction,useFamilyData} from './family-common'
export function ConversationAccess({profileId,teen}:{profileId:string;teen:boolean}) {
  const [password,setPassword]=useState('')
  const [recent,setRecent]=useState(false)
  const [reason,setReason]=useState('')
  const [grant,setGrant]=useState<FamilySafetyGrant>()
  const action=useFamilyAction()
  const access=useFamilyData<FamilyConversationAccess>(`/family/profiles/${profileId}/conversations${grant?`?safetyGrantId=${encodeURIComponent(grant.safetyGrantId)}`:''}`)
  return <Card className="space-y-5"><h2 className="text-xl font-bold">{teen?'Teen summaries & safety access':'Authorized conversation access'}</h2><FamilyQueryState pending={access.isPending} error={access.error} retry={()=>void access.refetch()}>{access.data&&<><p>{access.data.access==='SUMMARIES'?'Summary access applies to this teen profile.':'Full authorized access applies to this profile.'}</p><p className="text-sm text-muted-foreground">No school-scoped conversations are available yet. Learning conversations arrive in their own rollout; no legacy cross-school chat history is displayed here.</p></>}</FamilyQueryState>{teen&&<form method="post" className="space-y-4 border-t pt-4" onSubmit={event=>{event.preventDefault();action.mutate({path:`/family/profiles/${profileId}/safety-access`,body:{...(password?{password}:{}),reason}},{onSuccess:result=>{setGrant(result as FamilySafetyGrant);setPassword('');setReason('')}})}}><h3 className="font-bold">Request reasoned safety access</h3><p className="text-sm text-muted-foreground">A fresh password and a specific safety reason are required. Access is audited, limited to this child and expires. This request does not create conversation data.</p><Input label="Safety access reason" required minLength={20} maxLength={1000} value={reason} onChange={event=>setReason(event.target.value)}/><Input label="Your adult password for safety access" type="password" autoComplete="current-password" required={!recent} value={password} onChange={event=>setPassword(event.target.value)}/><Checkbox label="Use my recent sign-in instead (checked by the server)" checked={recent} onChange={event=>{setRecent(event.target.checked);setPassword('')}}/><Button type="submit" loading={action.isPending}>Request audited safety access</Button>{grant&&<p role="status">This child’s safety grant expires {new Date(grant.expiresAt).toLocaleTimeString()}.</p>}<FamilyFeedback pending={action.isPending} error={action.error}/></form>}</Card>
}
