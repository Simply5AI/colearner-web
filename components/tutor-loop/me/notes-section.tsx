'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { deleteTutorMemoryFact, forgetAllTutorMemory, getTutorMemory, type TutorProfile } from '@/lib/api/tutor-loop/profile'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import { Switch } from './tutor-section'
import { useProfilePatch, type MeWorkspace } from './use-profile'

const confidenceLabel = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' } as const

export function NotesSection({ workspace, profile, adult }: { workspace: MeWorkspace; profile: TutorProfile; adult: boolean }) {
  const options = { workspace }
  const patch = useProfilePatch(workspace)
  const [parentOpen, setParentOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const memory = useQuery({ queryKey: ['tutor-memory', workspace, profile.memoryOptIn], queryFn: () => getTutorMemory(options), retry: false, enabled: profile.memoryOptIn })
  const remove = useMutation({ mutationFn: (fact: { id: string; revision: number }) => deleteTutorMemoryFact(fact.id, fact.revision, options), onSuccess: () => void memory.refetch() })
  const forget = useMutation({ mutationFn: () => forgetAllTutorMemory(crypto.randomUUID(), options), onSuccess: () => { setConfirm(false); void memory.refetch() } })
  const facts = profile.memoryOptIn ? memory.data?.facts ?? [] : []
  const name = profile.name
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <b>{name} remembers how you learn</b>
          <span className="text-sm text-muted-foreground">{adult ? 'Only you can see these.' : 'Your parent can see these notes. Your school cannot.'}</span>
          {!adult && (
            <>
              <button type="button" className="self-start text-sm font-bold text-primary underline" aria-expanded={parentOpen} onClick={() => setParentOpen(!parentOpen)}>What does my parent see?</button>
              {parentOpen && <span className="text-sm">Your parent sees this list of notes, your plan and your progress. They don’t see your chats with {name}. Your school only sees your plan and progress.</span>}
            </>
          )}
        </div>
        <Switch label="Memory" on={profile.memoryOptIn} disabled={patch.isPending} onChange={(next) => patch.mutate({ memoryOptIn: next })} />
      </div>
      {patch.isError && <p role="alert" className="text-destructive">{friendlyError(patch.error, 'That could not be saved. Try again.').message}</p>}
      {profile.memoryOptIn && memory.isError && <p role="alert" className="text-destructive">Notes could not be loaded. <button type="button" className="underline" onClick={() => void memory.refetch()}>Try again</button></p>}
      {facts.length === 0 && !memory.isError && (
        <p className="text-muted-foreground">{profile.memoryOptIn ? `${name} hasn’t noted anything yet. It learns how you like to study as you go.` : `Memory is off. ${name} still helps and starts fresh each time.`}</p>
      )}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {facts.map((fact) => (
          <li key={fact.id} className="flex items-start justify-between gap-3 rounded-[var(--ds-radius)] border border-border bg-card p-3">
            <span><b className="block">{fact.statement}</b><span className="text-sm text-muted-foreground">How sure: {confidenceLabel[fact.confidence]}</span></span>
            <button type="button" className="ds-button ds-button-ghost" disabled={remove.isPending} onClick={() => remove.mutate(fact)}>Delete</button>
          </li>
        ))}
      </ul>
      {remove.isError && <p role="alert" className="text-destructive">{friendlyError(remove.error, 'That note could not be deleted. Try again.').message}</p>}
      {facts.length > 0 && <button type="button" className="ds-button ds-button-secondary self-start" onClick={() => setConfirm(true)}>Forget everything</button>}
      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="forget-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="flex w-full max-w-sm flex-col gap-3 rounded-[var(--ds-radius)] bg-background p-5">
            <b id="forget-title">Forget everything?</b>
            <span>{name} deletes all its notes about how you learn. Your plan and progress stay.</span>
            {forget.isError && <p role="alert" className="text-destructive">{friendlyError(forget.error, 'That could not be done. Try again.').message}</p>}
            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" autoFocus className="ds-button ds-button-secondary" onClick={() => setConfirm(false)}>Keep them</button>
              <button type="button" className="ds-button ds-button-primary" disabled={forget.isPending} onClick={() => forget.mutate()}>{forget.isPending ? 'Forgetting…' : 'Forget everything'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
