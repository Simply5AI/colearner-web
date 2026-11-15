'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { formatTutorDate } from '@/lib/tutor-loop/date'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'
import { tutorPracticeApi, type TutorPractice } from '@/lib/api/tutor-loop/practice'
import { MockBuilder } from './mock-builder'

const stateLabel: Record<string, string> = {
  NOT_STARTED: 'Not started', LEARNING: 'Learning', PRACTICING: 'Practising', SECURE: 'Secure', MASTERED: 'Mastered', NEEDS_REVIEW: 'Needs review',
}

/** TL10: readiness by exam area, all topics, needs practice, mock entry and past mocks. */
export function ExamPrepTab({ goalId, practice }: { goalId: string | null; practice: TutorPractice }) {
  const shell = useTutorShell()
  const [building, setBuilding] = useState(false)
  const q = useQuery({ queryKey: ['tutor-practice', 'exam-prep', goalId], queryFn: () => tutorPracticeApi.examPrep(goalId), retry: false })
  if (q.isPending) return <Skeleton className="h-32" />
  if (q.isError) return <ErrorState title="Exam prep did not load" description="Check your connection and try again." action={<Button onClick={() => q.refetch()}>Try again</Button>} />
  const d = q.data
  const exam = d.exams.find((e) => e.id === d.selectedExamId) ?? d.exams[0] ?? null
  if (!exam) return <div className="rounded-2xl border p-4 text-sm">You have no exam goal yet. Add an exam in <Link className="font-bold underline" href="/learn/me">Me</Link> to see readiness and sit a mock.</div>
  const state = d.state ?? (d.readiness?.evidence === 'ENOUGH' ? 'MEASURED' : 'NOT_ENOUGH_PRACTICE')
  const goal = practice.goalCards.find((g) => g.id === exam.goalId)
  const areaIds = new Set((goal?.topics ?? []).map((t) => t.topicId))
  const areas = practice.topics.filter((t) => areaIds.size === 0 || areaIds.has(t.id))
  const mockOk = shell.entry?.capabilities.canUseMock !== false && d.mockAvailable !== false && !d.examLocked
  const days = d.countdown?.days
  return <div className="space-y-4">
    <section aria-label="Readiness" className="rounded-2xl border p-4">
      {state === 'MEASURED' && d.readiness?.percent != null
        ? <p className="text-2xl font-black">{d.readiness.percent}% ready <span className="text-xs font-bold text-muted-foreground">Measured from your answers</span></p>
        : <p className="text-lg font-black">Not yet measured</p>}
      {state === 'NOT_ENOUGH_PRACTICE' && <p className="text-sm text-muted-foreground">Answer more questions on more topics and your readiness will appear here. Covered so far: {d.readiness?.topicsCovered ?? 0} of {d.readiness?.topicsTotal ?? areas.length} topics.</p>}
      {state === 'EXAM_PASSED' && <p className="text-sm text-muted-foreground">This exam date has passed.</p>}
      <p className="text-sm text-muted-foreground">{exam.title}{exam.date ? ` · ${formatTutorDate(exam.date)}` : ''}{typeof days === 'number' && days >= 0 ? ` · ${days} days left` : ''}</p>
    </section>
    <section aria-label="Mock exam" className="rounded-2xl border p-4">
      <b>Start a mock exam</b>
      {d.examLocked
        ? <p className="text-sm text-muted-foreground">A mock is already running. Finish it first.</p>
        : <p className="text-sm text-muted-foreground">Timed, no hints, {shell.tutorName} is away until you finish.</p>}
      <Button className="mt-2" disabled={!mockOk} onClick={() => setBuilding(true)}>Choose a mock</Button>
      {!mockOk && !d.examLocked && <p className="mt-1 text-xs text-muted-foreground">Mock exams are not available for this space yet.</p>}
    </section>
    {areas.length > 0 && <section aria-label="Topics by exam area"><h2 className="text-sm font-black">All topics</h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">{areas.map((t) => <li key={t.id} className="flex justify-between rounded-2xl border p-3 text-sm"><span>{t.title}</span><span className="font-bold">{stateLabel[t.state] ?? t.state}</span></li>)}</ul></section>}
    <section aria-label="Needs practice"><h2 className="text-sm font-black">Needs practice</h2>
      {d.weakConcepts.length === 0 && <p className="text-sm text-muted-foreground">Nothing stands out yet.</p>}
      <ul className="mt-2 space-y-2">{d.weakConcepts.map((w) => <li key={w.conceptId} className="flex items-center justify-between rounded-2xl border p-3 text-sm"><span>{w.label}</span>
        {w.topicId && <Link className="font-bold underline" href={`/learn/practice?topicId=${encodeURIComponent(w.topicId)}${goalId ? `&goalId=${encodeURIComponent(goalId)}` : ''}`}>Practise</Link>}</li>)}</ul></section>
    <section aria-label="Past mocks"><h2 className="text-sm font-black">Past mocks</h2>
      {d.pastMocks.length === 0 && <p className="text-sm text-muted-foreground">No mocks yet.</p>}
      <ul className="mt-2 space-y-2">{d.pastMocks.map((m) => <li key={m.sessionId} className="flex justify-between rounded-2xl border p-3 text-sm">
        <span>{formatTutorDate(m.submittedAt.slice(0, 10))}{m.conditions === false ? ' · practice simulation' : ''}</span>
        <Link className="font-bold underline" href={`/learn/practice/mock/${encodeURIComponent(m.sessionId)}/result`}>{m.scorePercent != null ? `${m.scorePercent}%` : 'Marking'}</Link></li>)}</ul></section>
    {building && <MockBuilder exam={exam} topics={areas} onClose={() => setBuilding(false)} />}
  </div>
}
