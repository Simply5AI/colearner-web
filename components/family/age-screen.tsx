'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Send } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Input, Select, CoCharacter } from '@/components/design-system'
import { FamilyFrame, FamilyFeedback, useFamilyAction } from './family-common'
import { familyBrowserRequest } from '@/lib/api/family-browser'
import type { AgeCheck, Handoff } from '@/lib/api/family'
import { useClientReady } from '@/components/auth/use-client-ready'

const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
export function AgeScreen() {
  const clientReady = useClientReady()
  const cache=useQueryClient()
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [check, setCheck] = useState<AgeCheck>()
  const [email, setEmail] = useState('')
  const [handoff, setHandoff] = useState<Handoff>()
  const [editing, setEditing] = useState(false)
  const action = useFamilyAction()
  const grownup = useMutation({mutationFn:async()=>{const callback=`/consent?ageCheckId=${encodeURIComponent(check?.ageCheckId??'')}`;await signOut({redirect:false});window.location.assign(`/login?callbackUrl=${encodeURIComponent(callback)}`)},retry:false})
  const status = useQuery({ queryKey: ['family-handoff', handoff?.id], queryFn: () => familyBrowserRequest<Handoff>(`/family/handoffs/${handoff?.id}`), enabled: !!handoff, refetchInterval: 15000, retry: false })
  const current = status.data ?? handoff
  const approved = current?.status === 'APPROVED'
  const title = approved ? 'You’re all set!' : current?.status==='EXPIRED' ? 'Your handoff link expired' : handoff && !editing ? 'Waiting for your grown-up' : check?.next === 'GUARDIAN' ? 'Let’s get a grown-up!' : check?.next === 'UNAVAILABLE' ? 'A little more growing first' : check?.next === 'ADULT' ? 'Ready for your next step' : 'When’s your birthday?'
  return <FamilyFrame title={title} co description="Your birthday helps us choose the right experience and ask a grown-up before younger learners start.">
    <Card className="space-y-6">
      {!check && <form method="post" className="space-y-5" onSubmit={event => { event.preventDefault(); action.mutate({ path: '/family/age-check', body: { dateOfBirth: `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}` } }, { onSuccess: result => setCheck(result as AgeCheck) }) }}>
        <div className="grid grid-cols-3 gap-3"><Select label="Day" required value={day} onChange={event => setDay(event.target.value)}><option value="">Day</option>{Array.from({length:31}, (_,i) => <option key={i+1}>{i+1}</option>)}</Select><Select label="Month" required value={month} onChange={event => setMonth(event.target.value)}><option value="">Month</option>{months.map((name,i) => <option key={name} value={i+1}>{name}</option>)}</Select><Select label="Year" required value={year} onChange={event => setYear(event.target.value)}><option value="">Year</option>{Array.from({length:121}, (_,i) => new Date().getFullYear()-i).map(value => <option key={value}>{value}</option>)}</Select></div>
        <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Why do we ask?</summary><p className="text-muted-foreground">So Co can teach in a way that fits you, and a grown-up can say yes for younger learners. We check the date on the server. No child name or school details are needed here.</p></details>
        <Button type="submit" disabled={!clientReady} loading={action.isPending}>Continue</Button>
      </form>}
      {check?.next === 'UNAVAILABLE' && <p>CoLearner is for learners aged six and above. Learning access stays closed. Please ask your grown-up for help.</p>}
      {check?.next === 'ADULT' && <><p>Your adult age check is saved. You can continue to your account workspace. Meeting Co and the full learner onboarding are being developed separately.</p><Link href="/workspaces" className="ds-button ds-button-primary">Continue to my workspace</Link></>}
      {check?.next === 'GUARDIAN' && (!handoff || editing) && <div className="space-y-5"><p>A parent or legal guardian needs to say yes before you start. Your school verifies who can help with your profile.</p><Button variant="secondary" className="w-full" loading={grownup.isPending} onClick={()=>grownup.mutate()}>My grown-up is here</Button><p className="text-sm text-muted-foreground">This signs your current account out so your grown-up can sign in with their own verified account. Your nonsecret birthday-check reference is retained; it never grants guardian access.</p><FamilyFeedback pending={grownup.isPending} error={grownup.error}/><form method="post" className="space-y-4 rounded-2xl bg-accent/40 p-4" onSubmit={event => { event.preventDefault(); action.mutate({ path: handoff ? `/family/handoffs/${handoff.id}` : '/family/handoffs', method: handoff ? 'PATCH' : 'POST', body: handoff ? { email } : { ageCheckId: check.ageCheckId, email } }, { onSuccess: result => { setHandoff(result as Handoff); cache.setQueryData(['family-handoff',(result as Handoff).id],result); setEmail(''); setEditing(false) } }) }}><h2 className="text-xl font-bold">Send them a link</h2><Input label="Parent or guardian email" type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} /><Button type="submit" loading={action.isPending}>{handoff ? 'Change address and send' : 'Send link'}</Button></form></div>}
      {current && !editing && <div className="space-y-4"><div className="flex justify-center">{!approved&&<Send aria-hidden="true" className="size-16 self-center text-primary rtl:-scale-x-100"/>}<CoCharacter band="tweens" state={approved ? 'celebrating' : 'idle'} decorative /></div><p>{approved ? 'Your school-linked profile now has current guardian consent. Choose your profile to continue.' : `A handoff was sent to ${current.maskedEmail}. A school-issued invitation and verified guardian consent are required before learning starts.`}</p><p className="text-sm text-muted-foreground">{approved ? 'Approved' : current.status==='EXPIRED' ? 'Expired — resend or change the address' : 'Pending school verification'} · expires {new Date(current.expiresAt).toLocaleDateString()}</p>{approved ? <Link href="/profiles" className="ds-button ds-button-primary">Choose my profile</Link> : <div className="flex flex-wrap gap-3"><Button loading={action.isPending} onClick={() => action.mutate({ path: `/family/handoffs/${current.id}/resend` }, { onSuccess: result => {setHandoff(result as Handoff);cache.setQueryData(['family-handoff',(result as Handoff).id],result)} })}>Resend link</Button><Button variant="ghost" onClick={() => setEditing(true)}>Use a different email</Button><Button variant="secondary" onClick={() => void status.refetch()}>Check approval</Button></div>}{status.error && <FamilyFeedback pending={false} error={status.error} />}</div>}
      <FamilyFeedback pending={action.isPending} error={action.error} />
      {check && !handoff && <Button variant="ghost" onClick={() => { setCheck(undefined); action.reset() }}>Back to birthday</Button>}
    </Card><p className="text-sm text-muted-foreground">We only ask for your birthday and a grown-up’s email before consent. Learning remains locked until all checks pass.</p>
  </FamilyFrame>
}
