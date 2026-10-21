'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signIn, getSession, useSession } from 'next-auth/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { LockKeyhole, Plus } from 'lucide-react'
import { Button, Card, Input, CoCharacter, Checkbox } from '@/components/design-system'
import { FamilyFrame, FamilyFeedback, FamilyQueryState } from './family-common'
import { PicturePin } from './picture-pin'
import {coColourFilter} from '@/lib/utils/family-policy'
import { familyDeviceRequest } from '@/lib/api/family-browser'
import { FamilyError, type DeviceProfile } from '@/lib/api/family'

export function ProfilesScreen() {
  const { data: session } = useSession()
  const [selected, setSelected] = useState<DeviceProfile>()
  const [schoolId, setSchoolId] = useState('')
  const [pictures, setPictures] = useState<number[]>([])
  const [wrong, setWrong] = useState(0)
  const [adult, setAdult] = useState<'family'|'add'|null>(null)
  const [password, setPassword] = useState('')
  const [recent,setRecent]=useState(false)
  const [email, setEmail] = useState('')
  const profiles = useQuery({ queryKey:['family-device-profiles'], queryFn:()=>familyDeviceRequest<{items:DeviceProfile[]}>('profiles'), retry:false })
  const enroll = useMutation({ mutationFn:()=>familyDeviceRequest('device','POST',password?{password}:{}), retry:false, onSuccess:()=>{setPassword('');window.location.assign('/profiles')} })
  const unlock = useMutation({ mutationFn:()=>familyDeviceRequest(`profiles/${selected?.id}/unlock`,'POST',{pictures}), retry:false, onSuccess:()=>{setPictures([]);window.location.assign('/learner')}, onError:error=>{setPictures([]);if(error instanceof FamilyError&&(error.code==='PIN_INCORRECT'||error.code==='PIN_HELP_REQUIRED'))setWrong(value=>value+1)} })
  const parent = useMutation({ mutationFn:async()=>{
    // A real password login establishes a fresh adult sid; old child access is revoked separately.
    const result = await signIn('credentials',{email,password,redirect:false})
    const fresh = result && !result.error ? await getSession({broadcast:false}) : null
    if (!fresh?.accessToken || !fresh.user?.id) throw new Error('That sign-in did not work. Check your adult account details and try again.')
    try { await familyDeviceRequest('child','DELETE') } catch { /* Expired child credentials cannot grant access. The BFF clears them. */ }
  }, retry:false, onSuccess:()=>{setPassword('');window.location.assign(adult==='add'?'/consent':'/family')} })
  const schools = [...new Map(profiles.data?.items.map(profile=>[profile.schoolId,{id:profile.schoolId,name:profile.schoolName}])??[]).values()]
  const visible = profiles.data?.items.filter(profile=>schoolId?profile.schoolId===schoolId:schools.length===1)??[]
  const locked = wrong>=3 || unlock.error instanceof FamilyError && (unlock.error.status===429||unlock.error.code==='PIN_HELP_REQUIRED')
  const title = adult ? 'A grown-up’s sign-in' : selected ? locked ? 'Ask your grown-up for help.' : wrong ? 'Oops! Try again.' : 'Your secret pictures' : 'Who’s learning today?'
  return <FamilyFrame title={title} co description={adult?'Parent and add-profile actions require a fresh adult account sign-in.':selected?`${selected.nickname} · ${selected.schoolName}`:'Pick a profile on this shared device. Each school profile keeps its own records.'}>
    {adult ? <Card><form method="post" className="space-y-5" onSubmit={event=>{event.preventDefault();parent.mutate()}}><Input label="Adult account email" type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/><Input label="Adult account password" type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/><Button type="submit" loading={parent.isPending}>Continue as parent or guardian</Button><Link href="/forgot-password" className="ds-button ds-button-ghost">Forgot password?</Link><Link href={`/login?callbackUrl=${adult==='add'?'/consent':'/family'}`} className="ds-button ds-button-secondary">Use my configured sign-in provider</Link><Button variant="secondary" onClick={()=>{setAdult(null);setPassword('');parent.reset()}}>Back</Button><FamilyFeedback pending={parent.isPending} error={parent.error}/></form></Card> : selected ? <Card className="space-y-5 text-center"><div className="flex justify-center"><CoCharacter band="kids" state={wrong?'encouraging':'asking'} decorative size={110}/></div>{!selected.pinConfigured?<p>A grown-up needs to set this profile’s picture PIN first.</p>:<><PicturePin value={pictures} onChange={setPictures} disabled={unlock.isPending||locked}/><Button loading={unlock.isPending} disabled={pictures.length!==3||locked} onClick={()=>unlock.mutate()}>Open my profile</Button>{locked&&<p role="status">Ask your grown-up for help. The server may lock picture entry for 15 minutes; changing devices cannot reset it.</p>}<FamilyFeedback pending={unlock.isPending} error={unlock.error}/></>}<Button variant="ghost" onClick={()=>{setSelected(undefined);setPictures([]);setWrong(0);unlock.reset()}}>Not me</Button><Button variant="secondary" onClick={()=>setAdult('family')}>Ask my grown-up</Button></Card> : <>
      {profiles.error instanceof FamilyError&&profiles.error.status===401 ? <Card className="space-y-5"><h2 className="text-xl font-bold">Set up a shared family device</h2><p>Enroll this device after verified guardian consent and a child picture PIN. Enrollment signs your adult session out on this device.</p>{session?.accessToken?<form method="post" className="space-y-4" onSubmit={event=>{event.preventDefault();enroll.mutate()}}><Input label="Your adult password to enroll this device" type="password" autoComplete="current-password" required={!recent} value={password} onChange={event=>setPassword(event.target.value)}/><Checkbox label="Use my recent sign-in instead (checked by the server)" checked={recent} onChange={event=>{setRecent(event.target.checked);setPassword('')}}/><p className="text-sm text-muted-foreground">For Google or another recent sign-in, the server must confirm you signed in within five minutes. If it cannot, sign in again.</p><Link href="/login?callbackUrl=/profiles" className="ds-button ds-button-ghost">Sign in again before enrolling</Link><Button type="submit" loading={enroll.isPending}>Enroll device and sign out adult</Button><FamilyFeedback pending={enroll.isPending} error={enroll.error}/></form>:<Button onClick={()=>setAdult('family')}>Parent or guardian sign in</Button>}<Link href="/consent" className="ds-button ds-button-secondary">Verify a child relationship first</Link></Card>:<FamilyQueryState pending={profiles.isPending} error={profiles.error} retry={()=>void profiles.refetch()}>
        {!!schools.length&&<fieldset className="space-y-3"><legend className="font-semibold">Choose school explicitly</legend><div className="flex flex-wrap gap-3">{schools.map(school=><Button key={school.id} variant={schoolId===school.id?'primary':'secondary'} onClick={()=>setSchoolId(school.id)}>{school.name}</Button>)}</div></fieldset>}
        {schools.length>1&&!schoolId&&<p>Choose a school above to show its profiles.</p>}
        {profiles.data?.items.length===0&&<Card><p>No eligible child profiles are available on this device. A verified guardian can review school links, consent and picture PIN setup.</p></Card>}
        <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:grid-cols-3">{visible.map(profile=><button key={profile.id} onClick={()=>{setSelected(profile);setWrong(0);unlock.reset()}} className="flex min-h-44 min-w-0 flex-col items-center gap-3 rounded-3xl border bg-background p-4 focus-visible:outline-4 focus-visible:outline-ring"><span className="flex size-36 items-center justify-center rounded-full bg-accent"><span style={{filter:coColourFilter[profile.colour]}}><CoCharacter band="kids" decorative size={128}/></span></span><span className="w-full break-words text-lg font-bold">{profile.nickname}</span><span className="w-full break-words text-sm text-muted-foreground">{profile.schoolName}</span></button>)}<button onClick={()=>setAdult('family')} className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl border bg-background p-4"><LockKeyhole size={44}/><span className="text-lg font-bold">Parent or guardian</span></button><button onClick={()=>setAdult('add')} className="flex min-h-44 flex-col items-center justify-center gap-3 rounded-3xl border bg-background p-4"><Plus size={44}/><span className="text-lg font-bold">Add profile</span><LockKeyhole size={18} aria-label="Adult sign-in required"/></button></div>
      </FamilyQueryState>}
    </>}
  </FamilyFrame>
}
