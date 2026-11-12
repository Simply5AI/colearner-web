'use client'

import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react'
import type { ImportPreviewRow } from '@/lib/api/teaching/question-imports'
import { typeLabel } from '@/lib/api/teaching/question-imports'

export type PreviewFilter = 'all' | 'problems' | 'duplicates'

const statusText: Record<ImportPreviewRow['status'], string> = { VALID: 'Ready', INVALID: 'Has a problem', DUPLICATE_SUGGESTION: 'Possible duplicate' }

/** Status is words plus an icon, never colour alone. A duplicate is a suggestion and is explained as one. */
function StatusCell({ row }: { row: ImportPreviewRow }) {
  const Icon = row.status === 'VALID' ? CheckCircle2 : row.status === 'INVALID' ? AlertTriangle : Copy
  return <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium"><Icon aria-hidden="true" className="size-4" />{statusText[row.status]}</span>
}

export function filterRows(rows: ImportPreviewRow[], filter: PreviewFilter) {
  return filter === 'problems' ? rows.filter(row => row.status === 'INVALID') : filter === 'duplicates' ? rows.filter(row => row.status === 'DUPLICATE_SUGGESTION') : rows
}

export function CsvPreviewTable({ rows, topicTitles }: { rows: ImportPreviewRow[]; topicTitles: Record<string, string> }) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="csv-preview-none">No rows match this filter.</p>
  return <div role="region" aria-label="Rows from your file" tabIndex={0} className="overflow-x-auto rounded-xl border border-border bg-card" data-testid="csv-preview-table">
    <table className="w-full min-w-[40rem] text-start text-sm">
      <caption className="sr-only">Each row of your file with its status, the question it would create and any problems found</caption>
      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
        <tr><th scope="col" className="px-3 py-2 text-start">Row</th><th scope="col" className="px-3 py-2 text-start">Status</th><th scope="col" className="px-3 py-2 text-start">Question</th><th scope="col" className="px-3 py-2 text-start">What to check</th></tr>
      </thead>
      <tbody>
        {rows.map(row => <tr key={row.rowNumber} data-testid="csv-row" data-status={row.status} data-row={row.rowNumber} className="border-t border-border align-top">
          <th scope="row" className="px-3 py-2 text-start font-semibold tabular-nums">{row.rowNumber}</th>
          <td className="px-3 py-2"><StatusCell row={row} /></td>
          <td className="max-w-[26rem] px-3 py-2">
            {row.content
              ? <><p className="break-words">{row.content.prompt}</p><p className="mt-0.5 text-xs text-muted-foreground">{typeLabel[row.content.type] ?? row.content.type}{row.content.topicId ? ` · ${topicTitles[row.content.topicId] ?? 'Topic'}` : ''}</p></>
              : <p className="text-muted-foreground">Could not be read as a question.</p>}
          </td>
          <td className="px-3 py-2">
            {row.errors.length > 0 && <ul className="list-disc space-y-0.5 ps-4" data-testid="csv-row-errors">{row.errors.map((error, index) => <li key={`${error.field}-${error.code}-${index}`} className="break-words"><span className="font-semibold">{error.field}:</span> {error.message}</li>)}</ul>}
            {row.duplicateOf && <p className="break-words" data-testid="csv-row-duplicate">{row.duplicateOf.questionId ? 'Looks like a question already in your bank.' : row.duplicateOf.rowNumber ? `Looks like row ${row.duplicateOf.rowNumber} in this file.` : 'Looks like another question.'} Not imported unless you choose to include duplicates.</p>}
            {row.errors.length === 0 && !row.duplicateOf && <span className="text-muted-foreground">Nothing to fix.</span>}
          </td>
        </tr>)}
      </tbody>
    </table>
  </div>
}
