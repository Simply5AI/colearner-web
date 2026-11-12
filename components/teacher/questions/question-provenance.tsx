import Link from 'next/link'
import { dateText } from '@/components/teacher/plans/plan-format'
import { originLabel, reviewLabel, type QuestionDetail } from '@/lib/api/teaching/question-schema'

/** Where a question came from. Only fields the server actually sent are shown; nothing is filled in. */
export function ProvenancePanel({ question }: { question: QuestionDetail }) {
  const p = question.provenance
  const rows: [string, React.ReactNode][] = [
    ['Source', originLabel[p.origin]],
    ...(p.authoredBy ? [['Written by', p.authoredBy] as [string, React.ReactNode]] : []),
    ...(p.packVersion ? [['Co pack version', p.packVersion] as [string, React.ReactNode]] : []),
    ...(p.promptRelease ? [['Co prompt release', p.promptRelease] as [string, React.ReactNode]] : []),
    ...(p.traceId ? [['Trace', <code key="t" className="break-all text-xs">{p.traceId}</code>] as [string, React.ReactNode]] : []),
    ...(p.batchId ? [['Co draft batch', <Link key="b" href={`/teacher/questions/review/${encodeURIComponent(p.batchId)}`} className="underline">Open the batch</Link>] as [string, React.ReactNode]] : []),
    ...(p.importId ? [['CSV import', <code key="i" className="break-all text-xs">{p.importId}</code>] as [string, React.ReactNode]] : []),
    ['Review', reviewLabel[question.reviewState]],
    ...(p.reviewedBy ? [['Reviewed by', `${p.reviewedBy}${p.reviewedAt ? ` on ${dateText(p.reviewedAt, true)}` : ''}`] as [string, React.ReactNode]] : []),
    ...(p.approvedBy ? [['Approved by', p.approvedBy] as [string, React.ReactNode]] : []),
  ]
  return <section aria-labelledby="provenance-title" className="space-y-3 rounded-xl border border-border p-4" data-testid="provenance">
    <h2 id="provenance-title" className="text-base font-bold">Where this came from</h2>
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">{rows.map(([term, value]) => <div key={term} className="contents"><dt className="text-muted-foreground">{term}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl>
    {p.origin === 'CO' && <p className="text-xs text-muted-foreground">Co drafted this question. It reaches learners only after you accept or edit and publish it.</p>}
    {question.revisions.length > 0 && <div>
      <h3 className="text-sm font-semibold">Versions</h3>
      <ul className="mt-1 space-y-1 text-sm" data-testid="revisions">{question.revisions.map(revision => <li key={revision.revision}>
        Version {revision.revision}: {revision.state === 'PUBLISHED' ? `published${revision.publishedAt ? ` ${dateText(revision.publishedAt, true)}` : ''}` : revision.state === 'DRAFT' ? 'unpublished draft' : 'discarded draft'}
      </li>)}</ul>
    </div>}
  </section>
}
