'use client'

import { useMemo, useState } from 'react'
import { Eye } from 'lucide-react'

import {
  getAdminLearningSessionDetail,
  type AdminLearningSessionDetailResponse,
  type AdminLearningSessionsResponse,
  type AdminLearningUser,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  EmptyState,
  formatDate,
  formatDuration,
  LearningDataSection,
  LearningFiltersCard,
  LearningPageIntro,
  recordBadge,
  useLearningFilters,
} from './shared'

const ALL = 'all'

export function AdminLearningSessions({
  data,
  user,
  authHeaders,
}: {
  data: AdminLearningSessionsResponse
  user: AdminLearningUser
  authHeaders: Record<string, string>
}) {
  const { params, setParam, clearParams } = useLearningFilters()
  const [detail, setDetail] = useState<AdminLearningSessionDetailResponse | null>(null)
  const [open, setOpen] = useState(false)

  const stats = useMemo(() => {
    const completed = data.items.filter((s) => s.status === 'COMPLETED').length
    const avgScore = data.items
      .filter((s) => s.score !== null)
      .reduce((sum, s) => sum + normalizeScore(s.score!), 0)
    const scored = data.items.filter((s) => s.score !== null).length
    return {
      completed,
      avgScore: scored > 0 ? Math.round(avgScore / scored) : null,
    }
  }, [data.items])

  const loadDetail = async (sessionId: string) => {
    setOpen(true)
    setDetail(null)
    setDetail(await getAdminLearningSessionDetail(authHeaders, user.id, sessionId))
  }

  return (
    <AdminLearningLayout user={user} active="sessions">
      <LearningPageIntro
        title="Recall sessions"
        description="Review completed and in-progress recall sessions, scores, time spent, and per-question attempts."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryChip label="On this page" value={String(data.items.length)} />
        <SummaryChip label="Completed" value={String(stats.completed)} />
        <SummaryChip
          label="Avg score (page)"
          value={stats.avgScore === null ? '—' : `${stats.avgScore}%`}
        />
      </div>

      <LearningFiltersCard>
        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Status</Label>
          <Select
            value={params.get('status') ?? ALL}
            onValueChange={(value) => setParam('status', value && value !== ALL ? value : '')}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Session status">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="ABANDONED">Abandoned</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Source</Label>
          <Select
            value={params.get('sourceId') ?? ALL}
            onValueChange={(value) => setParam('sourceId', value && value !== ALL ? value : '')}
          >
            <SelectTrigger className="h-9 w-48" aria-label="Session source">
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
          <Label className="mb-1.5 block text-muted-foreground">From</Label>
          <Input
            aria-label="From date"
            type="date"
            value={params.get('from') ?? ''}
            onChange={(event) => setParam('from', event.target.value)}
            className="h-9 w-40"
          />
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">To</Label>
          <Input
            aria-label="To date"
            type="date"
            value={params.get('to') ?? ''}
            onChange={(event) => setParam('to', event.target.value)}
            className="h-9 w-40"
          />
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Sort</Label>
          <Select
            value={params.get('sort') ?? 'started_desc'}
            onValueChange={(value) => value && setParam('sort', value)}
          >
            <SelectTrigger className="h-9 w-40" aria-label="Session sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="started_desc">Newest</SelectItem>
              <SelectItem value="started_asc">Oldest</SelectItem>
              <SelectItem value="score_desc">Score</SelectItem>
              <SelectItem value="attempts_desc">Attempts</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <Button variant="ghost" size="sm" className="h-9" onClick={clearParams}>
          Clear filters
        </Button>
      </LearningFiltersCard>

      <LearningDataSection
        title="Sessions"
        description="Click a row to inspect individual question attempts and answer keys."
      >
        {data.items.length === 0 ? (
          <EmptyState hint="Adjust filters or date range to find sessions.">
            No sessions match these filters
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Correct</th>
                  <th className="px-4 py-3">Time spent</th>
                  <th className="px-4 py-3 text-right">Concepts</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(session.startedAt)}</td>
                    <td className="px-4 py-3">{recordBadge(session.status)}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatScore(session.score)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {session.correctCount}/{session.attempts || session.totalQuestions}
                    </td>
                    <td className="px-4 py-3">{formatDuration(session.durationSeconds)}</td>
                    <td className="px-4 py-3 text-right">
                      <span title={session.concepts.join(', ') || undefined}>
                        {session.conceptCount}
                      </span>
                    </td>
                    <td className="px-4 py-3">{session.source?.title ?? 'Source unavailable'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadDetail(session.id)}
                        aria-label="View session detail"
                      >
                        <Eye className="h-4 w-4" />
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
        <SheetContent className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Session detail</SheetTitle>
            <SheetDescription>Per-question attempts, learner answers, and grading feedback.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {!detail ? (
              <EmptyState>Loading session…</EmptyState>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {recordBadge(detail.session.status)}
                    <span className="text-sm font-semibold">{formatScore(detail.session.score)} score</span>
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(detail.session.durationSeconds)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(detail.session.startedAt)} → {formatDate(detail.session.completedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{detail.session.attempts} attempts</span>
                    <span>{detail.session.conceptCount} concepts</span>
                    <span>{detail.session.source?.title ?? 'Source unavailable'}</span>
                  </div>
                </div>

                {detail.attempts.length === 0 ? (
                  <EmptyState>No attempts in this session</EmptyState>
                ) : (
                  detail.attempts.map((attempt) => (
                    <div key={attempt.id} className="rounded-xl border border-border/70 bg-card p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{attempt.questionText}</div>
                          <div className="text-xs text-muted-foreground">
                            {attempt.concept?.title ?? 'Removed concept'}
                          </div>
                        </div>
                        {attempt.isCorrect ? (
                          <Badge variant="secondary">Correct</Badge>
                        ) : (
                          <Badge variant="destructive">Incorrect</Badge>
                        )}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Learner answer
                          </div>
                          <ExpandableText value={attempt.userAnswer} />
                        </div>
                        <div>
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Correct answer
                          </div>
                          {attempt.correctAnswer ? (
                            <div className="whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
                              {attempt.correctAnswer}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No answer key stored</div>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Attempt score: {attempt.score ?? '—'}</span>
                        <span>Time spent: {formatDuration(attempt.timeSpentSeconds)}</span>
                        <span>Answered: {formatDate(attempt.createdAt)}</span>
                      </div>
                      {attempt.feedback && (
                        <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                          {attempt.feedback}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function formatScore(score: number | null) {
  if (score === null) return '—'
  return `${Math.round(normalizeScore(score))}%`
}

function normalizeScore(score: number) {
  return score <= 1 ? score * 100 : score
}

function ExpandableText({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = value.length > 180
  const visible = !isLong || expanded ? value : `${value.slice(0, 180)}...`

  return (
    <div>
      <div className="whitespace-pre-wrap break-words rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
        {visible}
      </div>
      {isLong && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? 'Show less' : 'Show full answer'}
        </Button>
      )}
    </div>
  )
}