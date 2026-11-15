'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { getTutorWorkspaceScope, tutorLoopClient } from '@/lib/api/tutor-loop/client'
import { useGoalFilter } from '@/lib/tutor-loop/goal-filter'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

const KEY = 'colearner.tutor.import-target'
const KEEP = ''
const safe = (v: string | null) => (v && /^[A-Za-z0-9_-]{1,128}$/.test(v) ? v : null)

function readTarget(): string {
  try { return window.sessionStorage.getItem(KEY) ?? KEEP } catch { return KEEP }
}
function writeTarget(value: string) {
  try { if (value) window.sessionStorage.setItem(KEY, value); else window.sessionStorage.removeItem(KEY) } catch { /* storage blocked: the choice still applies on this page */ }
}

/**
 * "Goes into" topic and goal picker for /learn/import. The import form itself is unchanged; once the import is accepted
 * (the page then carries `material`/`batch` ids) the chosen topic gets the material attached through the plans API.
 */
export function ImportTarget() {
  const params = useSearchParams()
  const shell = useTutorShell()
  const filter = useGoalFilter({ syncUrl: false })
  const workspace = getTutorWorkspaceScope()
  const ids = [...new Set((params.get('batch') ?? params.get('material') ?? '').split(',').map(safe).filter((x): x is string => !!x))].slice(0, 10)
  const [target, setTarget] = useState<string>(() => {
    const planId = safe(params.get('planId')), topicId = safe(params.get('topicId'))
    return planId && topicId ? `${planId}|${topicId}` : ''
  })
  const [goalId, setGoalId] = useState<string | null>(safe(params.get('goalId')) ?? filter.goalId)
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')
  const attached = useRef(false)

  useEffect(() => { if (!target) setTarget(readTarget()) }, [target])
  const plans = useQuery({ queryKey: ['tutor-plans', workspace, goalId], queryFn: () => tutorLoopClient.plans({ goalId, ownership: 'OWN', limit: 50 }, { workspace }), retry: false })
  const options = (plans.data?.items ?? []).flatMap((p) => p.phases.flatMap((ph) => ph.topics.filter((t) => !t.archived).map((t) => ({ value: `${p.id}|${t.id}`, label: t.title }))))
  const pick = (value: string) => { setTarget(value); writeTarget(value) }

  useEffect(() => {
    if (ids.length === 0 || !target || attached.current) return
    const [planId, topicId] = target.split('|')
    if (!planId || !topicId) return
    attached.current = true
    setStatus('working')
    Promise.all(ids.map((id) => tutorLoopClient.attachTopicMaterial(planId, topicId, id, { workspace })))
      .then(() => { setStatus('done'); writeTarget('') })
      .catch(() => { setStatus('failed'); attached.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), target])

  if (ids.length > 0) {
    return <div role="status" className="mx-auto w-full max-w-6xl px-4 sm:px-7">
      {status === 'working' && <p>Adding it to your topic…</p>}
      {status === 'done' && <p className="font-bold text-primary">Added to your topic.</p>}
      {status === 'failed' && <p role="alert">It was saved to your library but could not be added to the topic. <button type="button" className="font-bold underline" onClick={() => setStatus('idle')}>Try again</button></p>}
    </div>
  }
  return <section aria-label="Where this goes" className="mx-auto grid w-full max-w-6xl gap-3 px-4 pt-4 sm:grid-cols-2 sm:px-7">
    {shell.goals.length > 0 && <label className="grid gap-1 text-sm font-bold">Goal
      <select value={goalId ?? ''} onChange={(e) => { setGoalId(e.target.value || null); pick('') }} className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal">
        <option value="">All goals</option>{shell.goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></label>}
    <label className="grid gap-1 text-sm font-bold">Goes into
      <select value={target} onChange={(e) => pick(e.target.value)} className="min-h-11 rounded-lg border border-border bg-background px-3 font-normal">
        <option value={KEEP}>Keep in my library</option>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
  </section>
}
