'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/design-system'
import type { LearnerExam, TutorPlanTopic } from '@/lib/api/tutor-loop/client'
import {
  extraTimeOptions, generationFailureCopy, mockPresets, newRequestId, tutorPracticeApi,
  type ExtraTime, type MockPreset, type MockScope,
} from '@/lib/api/tutor-loop/practice'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { cn } from '@/lib/utils'

const scopes: { id: MockScope; label: string }[] = [{ id: 'WHOLE_EXAM', label: 'Whole exam' }, { id: 'WEAK', label: 'Weak topics' }, { id: 'TOPICS', label: 'Pick topics' }]
const mins = (s: number) => Math.round(s / 60)

/** Mock builder: preset, scope, conditions, extra time; polls the build; honest shortfall with start-shorter or add material. */
export function MockBuilder({ exam, topics, onClose }: { exam: LearnerExam; topics: TutorPlanTopic[]; onClose: () => void }) {
  const router = useRouter()
  const shell = useTutorShell()
  const [preset, setPreset] = useState<MockPreset>('QUICK')
  const [scope, setScope] = useState<MockScope>('WHOLE_EXAM')
  const [picked, setPicked] = useState<string[]>([])
  const [conditions, setConditions] = useState(true)
  const [extra, setExtra] = useState<ExtraTime>(0)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [reqId] = useState(newRequestId)
  const [startId] = useState(newRequestId)
  const create = useMutation({
    mutationFn: () => tutorPracticeApi.createMockBuild({ clientRequestId: reqId, examId: exam.id, preset, scope, conditions, ...(scope === 'TOPICS' ? { topicIds: picked } : {}) }),
    onSuccess: (b) => setBuildId(b.id),
  })
  const build = useQuery({
    queryKey: ['tutor-practice', 'mock-build', buildId], enabled: !!buildId, retry: false,
    queryFn: () => tutorPracticeApi.mockBuild(buildId!),
    refetchInterval: (q) => (q.state.data && ['QUEUED', 'RUNNING'].includes(q.state.data.status) ? 2000 : false),
  })
  const start = useMutation({
    mutationFn: (acceptShorter: boolean) => tutorPracticeApi.startMock(buildId!, { clientRequestId: startId, acceptShorter, extraTimePercent: extra }),
    onSuccess: (s) => router.push(`/learn/practice/mock/${encodeURIComponent(s.sessionId)}`),
  })
  const cancel = useMutation({ mutationFn: () => tutorPracticeApi.cancelMockBuild(buildId!), onSuccess: () => { setBuildId(null); create.reset() } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const b = build.data
  const waiting = !!buildId && (!b || b.status === 'QUEUED' || b.status === 'RUNNING')
  const canBuild = scope !== 'TOPICS' || picked.length > 0
  const limitHit = create.error && (create.error as { code?: string }).code === 'DAILY_MOCK_LIMIT'
  return <div role="dialog" aria-modal="true" aria-label="Mock exam" className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-background p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between"><h2 className="text-xl font-black">Mock exam</h2><button type="button" aria-label="Close" className="min-h-10 min-w-10 rounded-full border" onClick={onClose}>×</button></div>
      {!buildId && <div className="mt-3 space-y-4">
        <fieldset><legend className="text-sm font-black">Length</legend><div className="mt-1 flex flex-wrap gap-2">
          {(Object.keys(mockPresets) as MockPreset[]).map((p) => <button key={p} type="button" aria-pressed={preset === p} onClick={() => setPreset(p)}
            className={cn('min-h-11 rounded-2xl border px-3 text-left text-sm', preset === p && 'border-[var(--color-accent)] bg-[var(--color-accent-100)]')}><b>{mockPresets[p].label}</b><br />{mockPresets[p].questions} questions · {mockPresets[p].minutes} min</button>)}</div></fieldset>
        <fieldset><legend className="text-sm font-black">What to cover</legend><div className="mt-1 flex flex-wrap gap-2">
          {scopes.map((s) => <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => setScope(s.id)}
            className={cn('min-h-10 rounded-full border px-3 text-sm font-bold', scope === s.id && 'border-[var(--color-accent)] bg-[var(--color-accent-100)]')}>{s.label}</button>)}</div>
          {scope === 'TOPICS' && <div className="mt-2 flex flex-wrap gap-2">{topics.map((t) => <button key={t.id} type="button" aria-pressed={picked.includes(t.id)}
            onClick={() => setPicked((c) => (c.includes(t.id) ? c.filter((x) => x !== t.id) : [...c, t.id]))}
            className={cn('min-h-10 rounded-full border px-3 text-sm', picked.includes(t.id) && 'border-[var(--color-accent)] bg-[var(--color-accent-100)]')}>{t.title}</button>)}</div>}</fieldset>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={conditions} onChange={(e) => setConditions(e.target.checked)} className="mt-1" />
          <span><b>Exam conditions</b><br />No hints and {shell.tutorName} stays away until you finish. Off: still timed, labelled practice simulation.</span></label>
        <label className="block text-sm"><b>Extra time</b>
          <select value={extra} onChange={(e) => setExtra(Number(e.target.value) as ExtraTime)} className="ms-2 min-h-10 rounded-lg border px-2">
            {extraTimeOptions.map((x) => <option key={x} value={x}>{x === 0 ? 'None' : `+${x}%`}</option>)}</select></label>
        <p className="text-sm text-muted-foreground">You cannot pause a mock. If you close the page, the clock keeps running.</p>
        <Button disabled={!canBuild} loading={create.isPending} onClick={() => create.mutate()}>Build my mock</Button>
        {limitHit && <p role="alert" className="text-sm">You have reached today’s limit for building mock exams. Try again tomorrow.</p>}
        {create.error && !limitHit && <p role="alert" className="text-sm">{create.error.message}</p>}
      </div>}
      {waiting && <div role="status" aria-live="polite" className="mt-4 space-y-2"><p>{shell.tutorName} is putting your mock together…</p>
        {build.isError && <p>That is taking longer than usual. <button type="button" className="font-bold underline" onClick={() => build.refetch()}>Check again</button></p>}
        <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()}>Cancel</Button></div>}
      {b?.status === 'READY' && <div className="mt-4 space-y-2"><p><b>Your mock is ready.</b> {b.availableCount} questions · {mins(b.timeLimitSeconds + Math.ceil(b.timeLimitSeconds * extra / 100))} min</p>
        <Button loading={start.isPending} onClick={() => start.mutate(false)}>Start now</Button></div>}
      {b?.status === 'SHORTFALL' && <div className="mt-4 space-y-2"><p role="status">Your material only covers {b.availableCount} of {b.requestedCount} questions. We will not pad it with questions that are not from your material.</p>
        {b.availableCount >= b.minimumCount && b.alternatives.includes('START_SHORTER') && b.shorterTimeLimitSeconds != null &&
          <Button loading={start.isPending} onClick={() => start.mutate(true)}>Start a shorter mock · {b.availableCount} questions · {mins(b.shorterTimeLimitSeconds)} min</Button>}
        <a className="block font-bold underline" href="/learn/import">Add material</a></div>}
      {b && (b.status === 'FAILED' || b.status === 'CANCELLED') && <div className="mt-4 space-y-2"><p role="alert">{generationFailureCopy(b.reasonCode)}</p>
        <Button onClick={() => { setBuildId(null); create.reset() }}>Try again</Button></div>}
      {start.error && <p role="alert" className="mt-2 text-sm">{start.error.message}</p>}
    </div>
  </div>
}
