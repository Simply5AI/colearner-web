'use client'

import { useState } from 'react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AdminLearningLayout, CursorPager, EmptyState, formatDate, formatDuration, recordBadge, useLearningFilters } from './shared'

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

  const loadDetail = async (sessionId: string) => {
    setOpen(true)
    setDetail(null)
    setDetail(await getAdminLearningSessionDetail(authHeaders, user.id, sessionId))
  }

  return (
    <AdminLearningLayout user={user} active="sessions">
      <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <Input
          aria-label="From date"
          type="date"
          value={params.get('from') ?? ''}
          onChange={(event) => setParam('from', event.target.value)}
          className="h-9 w-40"
        />
        <Input
          aria-label="To date"
          type="date"
          value={params.get('to') ?? ''}
          onChange={(event) => setParam('to', event.target.value)}
          className="h-9 w-40"
        />

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

        <Button variant="outline" size="sm" className="h-9" onClick={clearParams}>
          Clear
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Time spent</th>
                  <th className="px-4 py-3">Concepts</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((session) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(session.startedAt)}</td>
                    <td className="px-4 py-3">{recordBadge(session.status)}</td>
                    <td className="px-4 py-3">{formatScore(session.score)}</td>
                    <td className="px-4 py-3">
                      {session.correctCount}/{session.attempts || session.totalQuestions}
                    </td>
                    <td className="px-4 py-3">{formatDuration(session.durationSeconds)}</td>
                    <td className="px-4 py-3">
                      <span title={session.concepts.join(', ') || undefined}>{session.conceptCount}</span>
                    </td>
                    <td className="px-4 py-3">{session.source?.title ?? 'Source unavailable'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => loadDetail(session.id)}>
                        <Eye className="h-3.5 w-3.5" />
                        View session detail
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
        <SheetContent className="overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Session detail</SheetTitle>
          </SheetHeader>
          {!detail ? (
            <EmptyState>Loading session...</EmptyState>
          ) : (
            <div className="space-y-4 px-4 pb-4">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {recordBadge(detail.session.status)}
                  <span className="text-sm font-semibold">{formatScore(detail.session.score)} score</span>
                  <span className="text-sm text-muted-foreground">{formatDuration(detail.session.durationSeconds)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(detail.session.startedAt)} - {formatDate(detail.session.completedAt)}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{detail.session.attempts} attempts</span>
                  <span>{detail.session.conceptCount} concepts</span>
                  <span>{detail.session.source?.title ?? 'Source unavailable'}</span>
                </div>
              </div>
              {detail.attempts.length === 0 ? (
                <EmptyState />
              ) : detail.attempts.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{attempt.questionText}</div>
                      <div className="text-xs text-muted-foreground">{attempt.concept?.title ?? 'Removed concept'}</div>
                    </div>
                    {attempt.isCorrect ? <Badge variant="secondary">correct</Badge> : <Badge variant="destructive">incorrect</Badge>}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">Learner answer</div>
                      <ExpandableText value={attempt.userAnswer} />
                    </div>
                    <div>
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">Correct answer</div>
                      {attempt.correctAnswer ? (
                        <div className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 text-sm">
                          {attempt.correctAnswer}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No answer key stored</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Attempt score: {attempt.score ?? 'No data yet'}</span>
                    <span>Time spent: {formatDuration(attempt.timeSpentSeconds)}</span>
                    <span>Answered: {formatDate(attempt.createdAt)}</span>
                  </div>
                  {attempt.feedback && (
                    <div className="mt-2 rounded-lg border bg-background p-2 text-xs text-muted-foreground">
                      {attempt.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}

function formatScore(score: number | null) {
  if (score === null) return '-'
  const normalized = score <= 1 ? score * 100 : score
  return `${Math.round(normalized)}%`
}

function ExpandableText({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = value.length > 180
  const visible = !isLong || expanded ? value : `${value.slice(0, 180)}...`

  return (
    <div>
      <div className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 text-sm">{visible}</div>
      {isLong && (
        <Button variant="ghost" size="sm" className="mt-1 h-7 px-2" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Show less' : 'Show full answer'}
        </Button>
      )}
    </div>
  )
}
