'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Button, ErrorState, Skeleton } from '@/components/design-system'
import { tutorPracticeApi, type MockReview } from '@/lib/api/tutor-loop/practice'

type Row = MockReview['items'][number]
const rec = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const optionText = (q: Row['question'], id: unknown) => {
  const opts = Array.isArray(q.options) ? (q.options as { id: string; text: string }[]) : []
  return opts.find((o) => o.id === id)?.text ?? String(id)
}

/** Plain-words rendering of a stored answer in any of the five mock kinds. */
export function describeAnswer(q: Row['question'], a: unknown): string {
  const r = rec(a)
  if (!r) return 'No answer'
  switch (r.kind) {
    case 'MCQ': return optionText(q, r.optionId)
    case 'TRUE_FALSE': return r.value ? 'True' : 'False'
    case 'SHORT_ANSWER': return String(r.text ?? '')
    case 'CLOZE': return Array.isArray(r.blanks) ? (r.blanks as { value: string }[]).map((b) => b.value).join(', ') : ''
    case 'ORDERING': {
      const items = Array.isArray(q.items) ? (q.items as { id: string; text: string }[]) : []
      return Array.isArray(r.order) ? (r.order as string[]).map((id) => items.find((i) => i.id === id)?.text ?? id).join(' → ') : ''
    }
    default: return 'Answered'
  }
}

const status = (row: Row) =>
  row.gradingStatus === 'PENDING' ? 'Still being marked' : row.answer == null ? 'Not answered' : row.score === 1 ? 'Right' : (row.score ?? 0) > 0 ? 'Partly right' : 'Not right'

/** TL12 review: each question with your answer, the right answer and the passage it came from (hidden when access has changed). */
export function MockReviewScreen({ sessionId }: { sessionId: string }) {
  const q = useQuery({ queryKey: ['tutor-practice', 'mock-review', sessionId], queryFn: () => tutorPracticeApi.mockReview(sessionId), retry: false })
  if (q.isPending) return <div className="mx-auto max-w-2xl p-6" aria-busy="true"><Skeleton className="h-40" /></div>
  if (q.isError) {
    const code = (q.error as { code?: string }).code
    return <div className="mx-auto max-w-2xl p-6"><ErrorState title={code === 'MOCK_NOT_SUBMITTED' ? 'Finish the mock first' : 'Your review did not load'}
      description={code === 'MOCK_NOT_SUBMITTED' ? 'Answers show after you submit.' : 'Try again.'}
      action={code === 'MOCK_NOT_SUBMITTED' ? undefined : <Button onClick={() => q.refetch()}>Try again</Button>} /></div>
  }
  return <div className="mx-auto w-full max-w-2xl space-y-3 px-4 pb-24 pt-6">
    <h1 className="text-2xl font-black">Review your mock</h1>
    <ol className="space-y-3">{q.data.items.map((row) => <li key={row.itemId} className="rounded-2xl border p-4 text-sm" aria-label={`Question ${row.index + 1}`}>
      <p className="font-black">{row.index + 1}. {row.question.prompt}</p>
      <p className="mt-1"><b>{status(row)}.</b> Your answer: {describeAnswer(row.question, row.answer)}</p>
      {row.correctAnswer != null && row.score !== 1 && <p>Right answer: {describeAnswer(row.question, row.correctAnswer)}</p>}
      {row.citations.length > 0
        ? <p className="mt-1 text-xs font-bold text-muted-foreground">From: {row.citations.map((c) => c.label).join(', ')}{row.citations[0]?.quote ? ` · “${row.citations[0].quote}”` : ''}</p>
        : <p className="mt-1 text-xs text-muted-foreground">The source is not available to show.</p>}
    </li>)}</ol>
    <Link className="font-bold underline" href={`/learn/practice/mock/${encodeURIComponent(sessionId)}/result`}>Back to result</Link>
  </div>
}
