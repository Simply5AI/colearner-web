'use client'

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { limits, type LessonBlock } from '@/lib/api/teaching/lesson-schema'
import { cn } from '@/lib/utils'

const blockWord = { TEXT: 'Text', LIST: 'List', TABLE: 'Table', KEY_TERMS: 'Key terms' } as const
const set = <T,>(items: T[], index: number, value: T) => items.map((entry, at) => at === index ? value : entry)
const remove = <T,>(items: T[], index: number) => items.filter((_, at) => at !== index)

function Counter({ value, max }: { value: string; max: number }) {
  return <span className={cn('text-[11px]', value.length > max ? 'font-semibold text-destructive' : 'text-muted-foreground')} aria-hidden="true">{value.length}/{max}</span>
}

/** Plain text only: nothing typed here is ever rendered as HTML, and links go in as materials, not inside a block. */
export function BlockEditor({ block, onChange, label }: { block: LessonBlock; onChange: (block: LessonBlock) => void; label: string }) {
  if (block.type === 'TEXT') return <div className="space-y-1">
    <label className="text-xs font-medium" htmlFor={`${label}-text`}>Text</label>
    <Textarea id={`${label}-text`} rows={4} value={block.text} onChange={e => onChange({ ...block, text: e.target.value })} maxLength={limits.text + 200} />
    <Counter value={block.text} max={limits.text} />
  </div>
  if (block.type === 'LIST') return <div className="space-y-1">
    <label className="text-xs font-medium" htmlFor={`${label}-list`}>List: one item per line (up to {limits.listItems})</label>
    <Textarea id={`${label}-list`} rows={4} value={block.items.join('\n')} onChange={e => onChange({ ...block, items: e.target.value.split('\n') })} />
  </div>
  if (block.type === 'TABLE') {
    const cols = block.headers.length
    return <div className="space-y-2">
      <p className="text-xs font-medium">Table (up to {limits.tableCols} columns and {limits.tableRows} rows)</p>
      <div className="overflow-x-auto"><table className="min-w-max border-separate border-spacing-1">
        <thead><tr>{block.headers.map((header, column) => <th key={column} scope="col"><Input aria-label={`Column ${column + 1} heading`} value={header} className="h-8" onChange={e => onChange({ ...block, headers: set(block.headers, column, e.target.value) })} /></th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{Array.from({ length: cols }, (_, column) => <td key={column}><Input aria-label={`Row ${rowIndex + 1}, column ${column + 1}`} value={row[column] ?? ''} className="h-8" onChange={e => onChange({ ...block, rows: set(block.rows, rowIndex, Array.from({ length: cols }, (_, c) => c === column ? e.target.value : (row[c] ?? ''))) })} /></td>)}
          <td><Button variant="ghost" size="icon" aria-label={`Remove row ${rowIndex + 1}`} disabled={block.rows.length <= 1} onClick={() => onChange({ ...block, rows: remove(block.rows, rowIndex) })}><Trash2 aria-hidden="true" /></Button></td></tr>)}</tbody>
      </table></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" disabled={cols >= limits.tableCols} onClick={() => onChange({ ...block, headers: [...block.headers, ''], rows: block.rows.map(row => [...row, '']) })}><Plus aria-hidden="true" />Column</Button>
        <Button variant="outline" size="lg" disabled={cols <= 1} onClick={() => onChange({ ...block, headers: block.headers.slice(0, -1), rows: block.rows.map(row => row.slice(0, -1)) })}>Remove last column</Button>
        <Button variant="outline" size="lg" disabled={block.rows.length >= limits.tableRows} onClick={() => onChange({ ...block, rows: [...block.rows, Array.from({ length: cols }, () => '')] })}><Plus aria-hidden="true" />Row</Button>
      </div>
    </div>
  }
  return <div className="space-y-2">
    <p className="text-xs font-medium">Key terms (up to {limits.stepKeyTerms})</p>
    {block.terms.map((entry, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
      <Input aria-label={`Term ${index + 1}`} placeholder="Term" value={entry.term} onChange={e => onChange({ ...block, terms: set(block.terms, index, { ...entry, term: e.target.value }) })} />
      <Input aria-label={`Meaning of term ${index + 1}`} placeholder="Meaning" value={entry.definition} onChange={e => onChange({ ...block, terms: set(block.terms, index, { ...entry, definition: e.target.value }) })} />
      <Button variant="ghost" size="icon" aria-label={`Remove term ${index + 1}`} disabled={block.terms.length <= 1} onClick={() => onChange({ ...block, terms: remove(block.terms, index) })}><Trash2 aria-hidden="true" /></Button>
    </div>)}
    <Button variant="outline" size="lg" disabled={block.terms.length >= limits.stepKeyTerms} onClick={() => onChange({ ...block, terms: [...block.terms, { term: '', definition: '' }] })}><Plus aria-hidden="true" />Term</Button>
  </div>
}

export function BlockFrame({ block, index, total, id, onChange, onMove, onRemove }: {
  block: LessonBlock; index: number; total: number; id: string; onChange: (block: LessonBlock) => void; onMove: (delta: -1 | 1) => void; onRemove: () => void
}) {
  return <div className="space-y-2 rounded-lg border border-border p-3" data-testid="lesson-block" data-block-type={block.type}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold">{blockWord[block.type]} block {index + 1}</p>
      <span className="flex">
        <Button variant="ghost" size="icon" aria-label={`Move block ${index + 1} up`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label={`Move block ${index + 1} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label={`Remove block ${index + 1}`} onClick={onRemove}><Trash2 aria-hidden="true" /></Button>
      </span>
    </div>
    <BlockEditor block={block} onChange={onChange} label={id} />
  </div>
}
