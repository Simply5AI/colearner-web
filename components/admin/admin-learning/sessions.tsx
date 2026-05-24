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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AdminLearningLayout, CursorPager, EmptyState, formatDate, formatDuration, recordBadge, useLearningFilters } from './shared'

export function AdminLearningSessions({
  data,
  user,
  authHeaders,
}: {
  data: AdminLearningSessionsResponse
  user: AdminLearningUser
  authHeaders: Record<string, string>
}) {
  const { params, setParam } = useLearningFilters()
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
        <select
          aria-label="Session status"
          value={params.get('status') ?? ''}
          onChange={(event) => setParam('status', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="ABANDONED">Abandoned</option>
        </select>
        <input
          aria-label="From date"
          type="date"
          value={params.get('from') ?? ''}
          onChange={(event) => setParam('from', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <input
          aria-label="To date"
          type="date"
          value={params.get('to') ?? ''}
          onChange={(event) => setParam('to', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        />
        <select
          aria-label="Sort"
          value={params.get('sort') ?? 'started_desc'}
          onChange={(event) => setParam('sort', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="started_desc">Newest</option>
          <option value="started_asc">Oldest</option>
          <option value="score_desc">Score</option>
          <option value="attempts_desc">Attempts</option>
        </select>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                    <td className="px-4 py-3">{session.score === null ? '—' : `${Math.round(session.score)}%`}</td>
                    <td className="px-4 py-3">{session.attempts}</td>
                    <td className="px-4 py-3">{formatDuration(session.durationSeconds)}</td>
                    <td className="px-4 py-3">{session.conceptCount}</td>
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
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
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
                  <span className="text-sm font-semibold">{detail.session.score ?? 0}% score</span>
                  <span className="text-sm text-muted-foreground">{formatDuration(detail.session.durationSeconds)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(detail.session.startedAt)} - {formatDate(detail.session.completedAt)}
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
                  <div className="whitespace-pre-wrap break-words rounded-lg bg-muted/40 p-2 text-sm">{attempt.userAnswer}</div>
                  {attempt.feedback && <div className="mt-2 text-xs text-muted-foreground">{attempt.feedback}</div>}
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}
