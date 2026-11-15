'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { signOut } from 'next-auth/react'
import { getTutorWorkspaceScope, tutorLoopClient } from '@/lib/api/tutor-loop/client'
import { AccessSection } from './access-section'
import { TutorAccessibilityApplier } from './accessibility-applier'
import { GoalsSection } from './goals-section'
import { NotesSection } from './notes-section'
import { TimeSection } from './time-section'
import { TutorSection } from './tutor-section'
import { ME_SECTIONS, type MeSectionId } from './me-sections'
import { useTutorProfile, type MeWorkspace } from './use-profile'

function SignOutPanel({ tutorName, icon, onStay }: { tutorName: string; icon: string; onStay: () => void }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <img src={`/tutor-loop/${icon.toLowerCase()}-idle.svg`} alt="" width={96} height={96} />
      <b>Sign out of CoLearner?</b>
      <span className="text-muted-foreground">Your plan and progress are saved.</span>
      <div className="flex gap-3">
        <button type="button" className="ds-button ds-button-primary" disabled={busy} onClick={() => { setBusy(true); void signOut({ redirectTo: '/login' }) }}>{busy ? 'Signing out…' : 'Sign out'}</button>
        <button type="button" className="ds-button ds-button-secondary" onClick={onStay}>Stay with {tutorName}</button>
      </div>
    </div>
  )
}

export function MeArea({ initialSection = 'tutor' }: { initialSection?: MeSectionId }) {
  const router = useRouter()
  const workspace: MeWorkspace = getTutorWorkspaceScope()
  const [section, setSection] = useState<MeSectionId>(initialSection)
  const entry = useQuery({ queryKey: ['tutor-entry', workspace], queryFn: () => tutorLoopClient.entry({ workspace }), retry: false })
  const profile = useTutorProfile(workspace)
  const adult = entry.data?.band === '18+'
  const current = ME_SECTIONS.find((item) => item.id === section) ?? ME_SECTIONS[2]
  const icon = profile.data?.icon ?? entry.data?.tutorIdentity?.icon ?? 'SPROUT'
  const tutorName = profile.data?.name ?? entry.data?.tutorIdentity?.name ?? 'Co'

  const pick = (id: MeSectionId) => (id === 'progress' ? router.push('/learn/progress') : setSection(id))
  let body: React.ReactNode
  if (section === 'goal') body = <GoalsSection workspace={workspace} adult={adult} tutorIcon={icon} tutorName={tutorName} />
  else if (section === 'time') body = <TimeSection workspace={workspace} tutorName={tutorName} />
  else if (section === 'space') {
    body = (
      <div className="flex flex-col gap-3">
        <div className="rounded-[var(--ds-radius)] border-2 border-primary p-4"><b className="block">{adult ? 'Personal' : 'Your school'}</b><span className="text-sm text-muted-foreground">You’re here</span></div>
        <Link href="/workspaces" className="ds-button ds-button-secondary self-start">Choose another space</Link>
      </div>
    )
  } else if (section === 'out') body = <SignOutPanel tutorName={tutorName} icon={icon} onStay={() => setSection('tutor')} />
  else if (profile.isPending) body = <p role="status" className="text-muted-foreground">Loading…</p>
  else if (profile.isError) {
    body = <p role="alert" className="text-destructive">Your tutor settings could not be loaded. <button type="button" className="underline" onClick={() => void profile.refetch()}>Try again</button></p>
  } else if (section === 'tutor') body = <TutorSection workspace={workspace} profile={profile.data} adult={adult} />
  else if (section === 'notes') body = <NotesSection workspace={workspace} profile={profile.data} adult={adult} />
  else body = <AccessSection workspace={workspace} profile={profile.data} />

  return (
    <div className="tutor-frame grid gap-6 py-6 md:grid-cols-[240px_minmax(0,1fr)]">
      <TutorAccessibilityApplier />
      <nav aria-label="Me" className="flex flex-col gap-1">
        {ME_SECTIONS.map((item) => (
          <button key={item.id} type="button" aria-current={item.id === section ? 'page' : undefined} onClick={() => pick(item.id)}
            className={`min-h-11 rounded-[var(--ds-radius)] px-3 text-start font-bold ${item.id === section ? 'bg-[var(--co-surface)] text-primary' : ''}`}>
            {item.id === 'notes' ? `${tutorName}’s notes about you` : item.label}
          </button>
        ))}
      </nav>
      <section aria-labelledby="me-title" className="flex min-w-0 flex-col gap-4">
        <h1 id="me-title" className="font-extrabold">{section === 'notes' ? `${tutorName}’s notes about you` : current.label}</h1>
        {body}
      </section>
    </div>
  )
}
