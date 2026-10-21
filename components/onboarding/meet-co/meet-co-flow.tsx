'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AgeBandScope, BrandMark, Button, CoCharacter, ErrorState, LoadingState } from '@/components/design-system'
import { bandOf, failureOf, nextRouteHref, onboardingApi, onboardingSteps, type OnboardingBand, type OnboardingDraft, type OnboardingState, type OnboardingStep, type SaveOnboarding } from '@/lib/api/onboarding'
import { needsLinkHelp } from '@/lib/api/learn-link'
import { SeeWhatsNeededLink } from '@/components/learn/see-whats-needed'
import { kidsLines, stepTitles } from './copy'
import { initialDraft, nextStep, patchFor, previousStep, validateStep, type DraftErrors } from './flow-logic'
import { useMeetCoIdentity } from './identity'
import { ContextStep, FirstImportStep, HelloStep, PersonaliseStep, SubjectsStep } from './steps'

function Frame({ band, children }: { band: OnboardingBand; children: ReactNode }) {
  return <AgeBandScope band={band} className="flex min-h-screen flex-col bg-background text-foreground">{children}</AgeBandScope>
}

export function MeetCoFlow() {
  const { scope, learnerName, kind } = useMeetCoIdentity()
  const query = useQuery({ queryKey: ['onboarding', scope], queryFn: onboardingApi.get, enabled: scope !== 'anonymous', retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false })
  if (query.isPending) return <Frame band="teens"><main className="m-auto w-full max-w-md p-6"><LoadingState label="Getting Co ready…" /></main></Frame>
  if (!query.data) {
    const failure = failureOf(query.error)
    const denied = failure === 'denied'
    const session = failure === 'session'
    return <Frame band="teens"><main className="m-auto w-full max-w-xl p-6"><ErrorState
      title={denied ? 'Setup is not available for this learner' : session ? 'Check who is learning' : 'Setup is unavailable'}
      description={query.error?.message ?? 'Setup could not be loaded.'}
      action={<div className="flex flex-wrap justify-center gap-3">
        {needsLinkHelp(query.error) && <SeeWhatsNeededLink />}
        {!denied && <Button onClick={() => void query.refetch()}>Try again</Button>}
        <Link className="ds-button ds-button-secondary" href={kind === 'child' ? '/profiles' : '/'}>{kind === 'child' ? 'Choose who is learning' : 'Go back'}</Link>
      </div>} /></main></Frame>
  }
  return <Flow state={query.data} learnerName={learnerName} fetching={query.isFetching} refreshError={query.isError ? query.error : null} refresh={() => void query.refetch()} />
}

const StepError = ({ message, onRetry, busy }: { message: string; onRetry: () => void; busy: boolean }) => (
  <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-destructive/40 bg-card p-4 text-destructive">
    <p className="min-w-0 flex-1 break-words">{message}</p>
    <Button variant="secondary" loading={busy} onClick={onRetry}>Try again</Button>
  </div>
)

function Flow({ state, learnerName, fetching, refreshError, refresh }: { state: OnboardingState; learnerName: string | null; fetching: boolean; refreshError: Error | null; refresh: () => void }) {
  const band = bandOf[state.band]
  const router = useRouter()
  const main = useRef<HTMLElement>(null)
  const mounted = useRef(false)
  const [step, setStep] = useState<OnboardingStep>(state.step)
  const [draft, setDraft] = useState<OnboardingDraft>(() => initialDraft(state))
  const [errors, setErrors] = useState<DraftErrors>({})
  const [resumed, setResumed] = useState(state.step !== 'HELLO' && !state.completed)
  const patch = (change: Partial<OnboardingDraft>) => {
    setDraft(old => ({ ...old, ...change }))
    setErrors(old => { const next = { ...old }; for (const key of Object.keys(change) as (keyof OnboardingDraft)[]) delete next[key]; return next })
  }

  const save = useMutation({ mutationFn: (input: SaveOnboarding & { target: OnboardingStep }) => onboardingApi.save({ step: input.step, draft: input.draft }), retry: false, onSuccess: (_result, input) => { setStep(input.target); setResumed(false) } })
  const curriculum = useMutation({ mutationFn: (input: SaveOnboarding) => onboardingApi.save(input), retry: false, onSuccess: refresh })
  const finish = useMutation({ mutationFn: async (target: string | null) => ({ result: await onboardingApi.complete(target === null ? 'LATER' : 'NOW'), target }), retry: false, onSuccess: ({ result, target }) => router.push(target ?? nextRouteHref(result.nextRoute)) })
  const skip = useMutation({ mutationFn: onboardingApi.skip, retry: false, onSuccess: () => router.push('/learn/home') })

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    main.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus()
  }, [step])

  const advance = () => {
    const found = validateStep(step, band, draft)
    setErrors(found)
    const target = nextStep(step)
    if (Object.keys(found).length > 0 || !target) return
    save.mutate({ target, step: target, draft: patchFor(step, band, draft, state) })
  }
  const back = () => { const target = previousStep(step); if (target) save.mutate({ target, step: target, draft: {} }) }
  const retrySave = () => {
    const target = save.variables?.target
    if (!target) return
    if (onboardingSteps.indexOf(target) > onboardingSteps.indexOf(step)) advance()
    else back()
  }
  const changeCurriculum = (change: Pick<Partial<OnboardingDraft>, 'board' | 'grade'>) => {
    const next = { ...draft, ...change }
    patch({ ...change, subjectIds: [] })
    if (next.board && next.grade) curriculum.mutate({ step: 'SUBJECTS', draft: { board: next.board, grade: next.grade, subjectIds: [] } })
  }

  if (state.completed) {
    return <Frame band={band}><main ref={main} className="m-auto flex w-full max-w-xl flex-col items-center gap-6 p-6 text-center">
      <CoCharacter band={band} state="celebrating" size={band === 'kids' ? 200 : 140} label="Co celebrating" />
      <h1 data-step-heading tabIndex={-1} className="font-[family-name:var(--font-display)] font-extrabold">{band === 'kids' ? kidsLines.done[0] : 'You are all set'}</h1>
      <p className="text-muted-foreground">{band === 'kids' ? kidsLines.done[1] : 'Your choices are saved. Pick up where you like.'}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link className="ds-button ds-button-primary" href="/learn/home">Go to Home</Link>
        <Link className="ds-button ds-button-secondary" href="/learn/import">Add something to learn</Link>
        <Link className="ds-button ds-button-secondary" href="/learn/snap">Snap a page</Link>
      </div>
    </main></Frame>
  }

  const index = onboardingSteps.indexOf(step)
  const showSkip = state.skipAllowed && band !== 'kids'
  const busy = save.isPending
  const curriculumError = curriculum.error ?? refreshError
  return <Frame band={band}>
    <header className="mx-auto flex w-full max-w-5xl items-center gap-4 p-4 sm:px-8">
      <div className="flex-1"><BrandMark /></div>
      <ol aria-label="Setup progress" className="m-0 flex list-none items-center gap-1.5 p-0">
        {onboardingSteps.map((item, position) => <li key={item} aria-current={position === index ? 'step' : undefined} className={`h-2.5 rounded-full motion-safe:transition-all ${position === index ? 'w-7' : 'w-2.5'} ${position <= index ? 'bg-primary' : 'bg-border'}`}><span className="sr-only">Step {position + 1} of {onboardingSteps.length}: {stepTitles[band][item]}</span></li>)}
      </ol>
      <div className="flex flex-1 justify-end">{showSkip && <Button variant="ghost" loading={skip.isPending} onClick={() => skip.mutate()}>Skip</Button>}</div>
    </header>
    <main ref={main} id="main" className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-8 px-4 pb-10 sm:px-8">
      {resumed && <p role="status" className="rounded-[var(--radius)] border border-border bg-muted p-3">{band === 'kids' ? 'Welcome back!' : 'Welcome back. Your choices were saved.'}</p>}
      {step === 'HELLO' && <HelloStep band={band} learnerName={learnerName} />}
      {step === 'CONTEXT' && <ContextStep band={band} state={state} />}
      {step === 'SUBJECTS' && <SubjectsStep band={band} state={state} draft={draft} patch={patch} learnerName={learnerName} errors={errors} curriculumBusy={curriculum.isPending || fetching} onCurriculumChange={changeCurriculum} />}
      {step === 'PERSONALISE' && <PersonaliseStep band={band} state={state} draft={draft} patch={patch} learnerName={learnerName} errors={errors} />}
      {step === 'FIRST_IMPORT' && <FirstImportStep band={band} busy={finish.isPending} onChoose={target => finish.mutate(target)} />}
      {step === 'SUBJECTS' && curriculumError && <StepError message={curriculumError.message} busy={curriculum.isPending || fetching} onRetry={() => (curriculum.error && curriculum.variables ? curriculum.mutate(curriculum.variables) : refresh())} />}
      {save.error && <StepError message={save.error.message} busy={busy} onRetry={retrySave} />}
      {finish.error && <StepError message={finish.error.message} busy={finish.isPending} onRetry={() => finish.mutate(finish.variables ?? null)} />}
      {skip.error && <StepError message={skip.error.message} busy={skip.isPending} onRetry={() => skip.mutate()} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>{index > 0 && <Button variant="secondary" disabled={busy || finish.isPending} onClick={back}>Back</Button>}</div>
        {step !== 'FIRST_IMPORT' && <Button loading={busy} onClick={advance}>{step === 'HELLO' ? 'Let’s go' : 'Next'}</Button>}
      </div>
    </main>
  </Frame>
}
