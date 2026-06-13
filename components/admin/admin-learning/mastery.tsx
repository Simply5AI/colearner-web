'use client'

import Link from 'next/link'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AdminLearningLayout,
  CursorPager,
  DebouncedInput,
  EmptyState,
  formatDate,
  formatDuration,
  LearningDataSection,
  LearningFiltersCard,
  LearningPageIntro,
  MASTERY_LEVEL_STYLES,
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
      LEVELS.some((option) => option.value === level),
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

  const totalTracked = LEVELS.reduce((sum, level) => sum + (data.summary[level.value] ?? 0), 0)

  return (
    <AdminLearningLayout user={user} active="mastery">
      <LearningPageIntro
        title="Mastery ledger"
        description="Concept-by-concept progress with review ease, attempt accuracy, and question history for this learner."
      />

      <LearningFiltersCard>
        <label className="min-w-[220px] flex-1 text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Search</Label>
          <DebouncedInput
            defaultValue={params.get('search') ?? ''}
            placeholder="Search concepts"
            onValue={(value) => setParam('search', value)}
          />
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Level</Label>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-w-40 justify-between"
                  aria-label="Learning level"
                />
              }
            >
              {selectedLevels.length === 0
                ? 'All levels'
                : `${selectedLevels.length} level${selectedLevels.length === 1 ? '' : 's'}`}
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
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
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Source</Label>
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
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Sort</Label>
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
        </label>

        <Button variant="ghost" size="sm" className="h-9" onClick={clearParams}>
          Clear filters
        </Button>
      </LearningFiltersCard>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {LEVELS.map((level) => {
          const style = MASTERY_LEVEL_STYLES[level.value]
          return (
            <div
              key={level.value}
              className={`rounded-xl border border-border/70 p-3 ${style?.bg ?? 'bg-card'}`}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: style?.color }}
                />
                {level.label}
              </div>
              <div className="mt-2 font-mono text-2xl font-bold">{data.summary[level.value]}</div>
            </div>
          )
        })}
      </div>

      <LearningDataSection
        title="Concepts"
        description={`${totalTracked.toLocaleString()} concepts tracked · showing ${data.items.length} on this page`}
      >
        {data.items.length === 0 ? (
          <EmptyState hint="Try clearing filters or pick another source extraction.">
            No concepts match these filters
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Concept</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3 text-right">Attempts</th>
                  <th className="px-4 py-3 text-right">Correct</th>
                  <th className="px-4 py-3">Last reviewed</th>
                  <th className="px-4 py-3">Next review</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-medium">{item.title}</td>
                    <td className="px-4 py-3">{recordBadge(item.level)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.attempts}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {item.correctPercent === null ? '—' : `${item.correctPercent}%`}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.lastReviewedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(item.nextReviewAt)}</td>
                    <td className="px-4 py-3">
                      {item.source ? (
                        <Link
                          href="/admin/content/extractions"
                          className="text-primary hover:underline"
                        >
                          {item.source.title}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Source unavailable</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadHistory(item.id, item.title)}
                        aria-label="View question history"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CursorPager nextCursor={data.nextCursor} />
      </LearningDataSection>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{activeConcept?.title ?? 'Concept'}</SheetTitle>
            <SheetDescription>Question attempt history for this concept.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {!history ? (
              <EmptyState>Loading history…</EmptyState>
            ) : history.items.length === 0 ? (
              <EmptyState hint="Attempts appear after the learner answers questions in recall sessions.">
                No attempts recorded
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {history.items.map((attempt) => (
                  <div key={attempt.id} className="rounded-xl border border-border/70 bg-card p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{attempt.questionText}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {formatDate(attempt.createdAt)} · {formatDuration(attempt.timeSpentSeconds)}
                        </div>
                      </div>
                      {attempt.isCorrect ? (
                        <Badge variant="secondary">Correct</Badge>
                      ) : (
                        <Badge variant="destructive">Incorrect</Badge>
                      )}
                    </div>
                    <div className="grid gap-3 text-sm">
                      <AnswerBlock label="Learner answer" value={attempt.userAnswer} />
                      <AnswerBlock
                        label="Correct answer"
                        value={attempt.correctAnswer ?? 'No answer key stored'}
                        muted={!attempt.correctAnswer}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Attempt score: {attempt.score ?? '—'}</span>
                      <span>Session score: {attempt.sessionScore ?? '—'}</span>
                    </div>
                    {attempt.feedback && (
                      <p className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                        {attempt.feedback}
                      </p>
                    )}
                  </div>
                ))}
                {history.nextCursor && activeConcept && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      loadHistory(activeConcept.id, activeConcept.title, history.nextCursor ?? undefined)
                    }
                  >
                    Load more attempts
                  </Button>
                )}
              </div>
            )}
          </SheetBody>
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
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          muted
            ? 'text-sm text-muted-foreground'
            : 'whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/30 p-3 text-sm'
        }
      >
        {value}
      </div>
    </div>
  )
}