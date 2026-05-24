'use client'

import { useState } from 'react'
import { History } from 'lucide-react'

import {
  getAdminLearningConceptAttempts,
  type AdminLearningConceptAttemptsResponse,
  type AdminLearningMasteryResponse,
  type AdminLearningUser,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AdminLearningLayout, CursorPager, DebouncedInput, EmptyState, formatDate, recordBadge, useLearningFilters } from './shared'

export function AdminLearningMastery({
  data,
  user,
  authHeaders,
}: {
  data: AdminLearningMasteryResponse
  user: AdminLearningUser
  authHeaders: Record<string, string>
}) {
  const { params, setParam } = useLearningFilters()
  const [history, setHistory] = useState<AdminLearningConceptAttemptsResponse | null>(null)
  const [historyTitle, setHistoryTitle] = useState('')
  const [open, setOpen] = useState(false)

  const loadHistory = async (conceptId: string, title: string) => {
    setOpen(true)
    setHistory(null)
    setHistoryTitle(title)
    setHistory(await getAdminLearningConceptAttempts(authHeaders, user.id, conceptId))
  }

  return (
    <AdminLearningLayout user={user} active="mastery">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DebouncedInput
          defaultValue={params.get('search') ?? ''}
          placeholder="Search concepts"
          onValue={(value) => setParam('search', value)}
        />
        <select
          aria-label="Learning level"
          value={params.get('levels') ?? ''}
          onChange={(event) => setParam('levels', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All levels</option>
          <option value="NEW">New</option>
          <option value="LEARNING">Learning</option>
          <option value="WEAK">Weak</option>
          <option value="MASTERED">Mastered</option>
        </select>
        <select
          aria-label="Source"
          value={params.get('sourceId') ?? ''}
          onChange={(event) => setParam('sourceId', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All sources</option>
          {data.sources.map((source) => (
            <option key={source.id} value={source.id}>{source.title}</option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={params.get('sort') ?? 'next_review_asc'}
          onChange={(event) => setParam('sort', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="next_review_asc">Next review</option>
          <option value="last_reviewed_desc">Last reviewed</option>
          <option value="attempts_desc">Attempts</option>
        </select>
        <Button variant="outline" size="sm" onClick={() => window.location.assign(window.location.pathname)}>
          Clear
        </Button>
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-5">
        {Object.entries(data.summary).map(([level, count]) => (
          <div key={level} className="rounded-lg border bg-card px-3 py-2">
            <div className="text-xs text-muted-foreground">{level.toLowerCase()}</div>
            <div className="mt-1 font-mono text-lg font-bold">{count}</div>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                    <td className="px-4 py-3">{item.correctPercent === null ? '—' : `${item.correctPercent}%`}</td>
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
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{historyTitle} question history</SheetTitle>
          </SheetHeader>
          {!history ? (
            <EmptyState>Loading history...</EmptyState>
          ) : history.items.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3 px-4 pb-4">
              {history.items.map((attempt) => (
                <div key={attempt.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{attempt.questionText}</div>
                    {attempt.isCorrect ? <Badge variant="secondary">correct</Badge> : <Badge variant="destructive">incorrect</Badge>}
                  </div>
                  <div className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{attempt.userAnswer}</div>
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
