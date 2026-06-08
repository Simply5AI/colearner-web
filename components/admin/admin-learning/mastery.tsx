'use client'

import { useState } from 'react'
import { ChevronDown, History } from 'lucide-react'

import {
  getAdminLearningConceptAttempts,
  type AdminLearningConceptAttemptsResponse,
  type AdminLearningMasteryLevel,
  type AdminLearningMasteryResponse,
  type AdminLearningUser,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  AdminLearningLayout,
  CursorPager,
  DebouncedInput,
  EmptyState,
  formatDate,
  formatDuration,
  recordBadge,
  useLearningFilters,
} from './shared'

const ALL = 'all'
const LEVELS: Array<{ value: AdminLearningMasteryLevel; label: string }> = [
  { value: 'NEW', label: 'New' },
  { value: 'LEARNING', label: 'Learning' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'WEAK', label: 'Weak' },
  { value: 'MASTERED', label: 'Mastered' },
]

export function AdminLearningMastery({
  data,
  user,
  authHeaders,
}: {
  data: AdminLearningMasteryResponse
  user: AdminLearningUser
  authHeaders: Record<string, string>
}) {
  const { params, setParam, clearParams } = useLearningFilters()
  const [history, setHistory] = useState<AdminLearningConceptAttemptsResponse | null>(null)
  const [activeConcept, setActiveConcept] = useState<{ id: string; title: string } | null>(null)
  const [open, setOpen] = useState(false)

  const selectedLevels = (params.get('levels') ?? '')
    .split(',')
    .filter((level): level is AdminLearningMasteryLevel =>
      LEVELS.some((option) => option.value === level)
    )

  const toggleLevel = (level: AdminLearningMasteryLevel) => {
    const next = new Set(selectedLevels)
    if (next.has(level)) next.delete(level)
    else next.add(level)
    setParam('levels', Array.from(next).join(','))
  }

  const loadHistory = async (conceptId: string, title: string, cursor?: string) => {
    setOpen(true)
    setActiveConcept({ id: conceptId, title })
    if (!cursor) setHistory(null)
    const next = await getAdminLearningConceptAttempts(authHeaders, user.id, conceptId, { cursor })
    setHistory((current) => {
      if (!cursor || !current) return next
      return {
        items: [...current.items, ...next.items],
        nextCursor: next.nextCursor,
      }
    })
  }

  return (
    <AdminLearningLayout user={user} active="mastery">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DebouncedInput
          defaultValue={params.get('search') ?? ''}
          placeholder="Search concepts"
          onValue={(value) => setParam('search', value)}
        />

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="h-9 min-w-40 justify-between" aria-label="Learning level" />}>
            {selectedLevels.length === 0 ? 'All levels' : `${selectedLevels.length} level${selectedLevels.length === 1 ? '' : 's'}`}
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Learning level</div>
            {LEVELS.map((level) => (
              <DropdownMenuCheckboxItem
                key={level.value}
                checked={selectedLevels.includes(level.value)}
                onCheckedChange={() => toggleLevel(level.value)}
              >
                {level.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={params.get('sourceId') ?? ALL}
          onValueChange={(value) => setParam('sourceId', value && value !== ALL ? value : '')}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Source">
            <SelectValue placeholder="All sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {data.sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={params.get('sort') ?? 'next_review_asc'}
          onValueChange={(value) => value && setParam('sort', value)}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="next_review_asc">Next review</SelectItem>
            <SelectItem value="next_review_desc">Latest review due</SelectItem>
            <SelectItem value="last_reviewed_desc">Last reviewed</SelectItem>
            <SelectItem value="attempts_desc">Attempts</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="h-9" onClick={clearParams}>
          Clear
        </Button>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-5">
        {LEVELS.map((level) => (
          <div key={level.value} className="rounded-lg border bg-card px-3 py-2">
            <div className="text-xs text-muted-foreground">{level.label}</div>
            <div className="mt-1 font-mono text-lg font-bold">{data.summary[level.value]}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Concept</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Correct</th>
                  <th className="px-4 py-3">Last reviewed</th>
                  <th className="px-4 py-3">Next review</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{recordBadge(item.level)}</td>
                    <td className="px-4 py-3">{item.attempts}</td>
                    <td className="px-4 py-3">{item.correctPercent === null ? '-' : `${item.correctPercent}%`}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.lastReviewedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.nextReviewAt)}</td>
                    <td className="px-4 py-3">{item.source?.title ?? 'Source unavailable'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => loadHistory(item.id, item.title)}>
                        <History className="h-3.5 w-3.5" />
                        View question history
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CursorPager nextCursor={data.nextCursor} />
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{activeConcept?.title ?? 'Concept'} question history</SheetTitle>
          </SheetHeader>
          {!history ? (
            <EmptyState>Loading history...</EmptyState>
          ) : history.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3 px-4 pb-4">
              {history.items.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{attempt.questionText}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(attempt.createdAt)} - {formatDuration(attempt.timeSpentSeconds)}
                      </div>
                    </div>
                    {attempt.isCorrect ? <Badge variant="secondary">correct</Badge> : <Badge variant="destructive">incorrect</Badge>}
                  </div>
                  <div className="grid gap-2 text-sm">
                    <AnswerBlock label="Learner answer" value={attempt.userAnswer} />
                    <AnswerBlock label="Correct answer" value={attempt.correctAnswer ?? 'No answer key stored'} muted={!attempt.correctAnswer} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Attempt score: {attempt.score ?? 'No data yet'}</span>
                    <span>Session score: {attempt.sessionScore ?? 'No data yet'}</span>
                  </div>
                  {attempt.feedback && <div className="mt-2 text-xs text-muted-foreground">{attempt.feedback}</div>}
                </div>
              ))}
              {history.nextCursor && activeConcept && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => loadHistory(activeConcept.id, activeConcept.title, history.nextCursor ?? undefined)}
                >
                  Load more attempts
                </Button>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}

function AnswerBlock({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      <div className={muted ? 'text-sm text-muted-foreground' : 'whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 text-sm'}>
        {value}
      </div>
    </div>
  )
}
