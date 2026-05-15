'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  Target,
  Link2,
  CheckCircle2,
  Pause,
  Trash2,
  BookOpen,
  Brain,
  X,
  Sparkles,
  Lightbulb,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { queryKeys } from '@/lib/api/query-keys'
import { listExtractions } from '@/lib/api/extraction'
import {
  useGoals,
  useGoalDetail,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useLinkExtraction,
  useUnlinkExtraction,
  useGoalMemoryInsights,
  useAcceptGoalMemorySuggestion,
  useDismissGoalMemorySuggestion,
} from '@/lib/hooks/use-goals'
import type { GoalWithProgress } from '@/lib/types'

interface GoalTrackerProps {
  initialGoals: GoalWithProgress[]
}

function MiniProgressRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
        {percent}%
      </span>
    </div>
  )
}

function CreateGoalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const createMutation = useCreateGoal()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
      })
      toast.success('Goal created')
      setTitle('')
      setDescription('')
      onClose()
    } catch {
      toast.error('Failed to create goal')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <Input
            placeholder="What do you want to master?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={!title.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Goal'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LinkExtractionDialog({
  open,
  onClose,
  goalId,
  linkedIds,
}: {
  open: boolean
  onClose: () => void
  goalId: string
  linkedIds: string[]
}) {
  const { data: session } = useSession()
  const [search, setSearch] = useState('')
  const linkMutation = useLinkExtraction()

  const { data: extractionsData, isLoading } = useQuery({
    queryKey: [...queryKeys.extraction.all, 'completed-list'],
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return listExtractions(
        { Authorization: `Bearer ${session.accessToken}` },
        { status: 'COMPLETED', limit: 100 }
      )
    },
    enabled: open && !!session?.accessToken,
  })

  const allExtractions = extractionsData?.data ?? []
  const filtered = allExtractions
    .filter((e) => !linkedIds.includes(e.id))
    .filter(
      (e) => !search || (e.title ?? '').toLowerCase().includes(search.toLowerCase())
    )

  async function handleLink(extractionId: string) {
    try {
      await linkMutation.mutateAsync({ goalId, extractionId })
      toast.success('Source linked')
    } catch {
      toast.error('Failed to link source')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link a Source</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {search ? 'No matching sources' : 'All sources already linked'}
              </p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleLink(e.id)}
                  disabled={linkMutation.isPending}
                  className="flex w-full items-center justify-between rounded-lg border border-border p-2.5 text-left text-sm hover:border-primary/30 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium line-clamp-1">{e.title ?? 'Untitled'}</p>
                    <p className="text-[10px] text-muted-foreground">{e.conceptCount} concepts</p>
                  </div>
                  <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function GoalDetailSheet({
  goalId,
  onClose,
}: {
  goalId: string | null
  onClose: () => void
}) {
  const [linkOpen, setLinkOpen] = useState(false)
  const { data: detail, isLoading } = useGoalDetail(goalId)
  const updateMutation = useUpdateGoal()
  const deleteMutation = useDeleteGoal()
  const unlinkMutation = useUnlinkExtraction()
  const acceptSuggestionMutation = useAcceptGoalMemorySuggestion()
  const dismissSuggestionMutation = useDismissGoalMemorySuggestion()
  const { data: insights, isLoading: insightsLoading } = useGoalMemoryInsights(goalId)

  async function handleStatus(status: 'COMPLETED' | 'PAUSED' | 'ACTIVE') {
    if (!goalId) return
    try {
      await updateMutation.mutateAsync({ id: goalId, data: { status } })
      toast.success(`Goal ${status === 'ACTIVE' ? 'resumed' : status.toLowerCase()}`)
      if (status !== 'ACTIVE') onClose()
    } catch {
      toast.error('Failed to update goal')
    }
  }

  async function handleDelete() {
    if (!goalId) return
    try {
      await deleteMutation.mutateAsync(goalId)
      toast.success('Goal deleted')
      onClose()
    } catch {
      toast.error('Failed to delete goal')
    }
  }

  async function handleUnlink(extractionId: string) {
    if (!goalId) return
    try {
      await unlinkMutation.mutateAsync({ goalId, extractionId })
    } catch {
      toast.error('Failed to unlink source')
    }
  }

  async function handleAcceptSuggestion(suggestionId: string) {
    if (!goalId) return
    try {
      await acceptSuggestionMutation.mutateAsync({ goalId, suggestionId })
      toast.success('Source linked')
    } catch {
      toast.error('Failed to accept suggestion')
    }
  }

  async function handleDismissSuggestion(suggestionId: string) {
    if (!goalId) return
    try {
      await dismissSuggestionMutation.mutateAsync({ goalId, suggestionId })
      toast.success('Suggestion dismissed')
    } catch {
      toast.error('Failed to dismiss suggestion')
    }
  }

  const linkedIds = detail?.extractions.map((e) => e.extractionId) ?? []

  return (
    <>
      <Sheet open={!!goalId} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-md">
          {isLoading || !detail ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader className="border-b border-border px-6 pb-4 pt-6">
                <div className="flex items-start gap-4">
                  <MiniProgressRing percent={detail.progressPercent} size={72} />
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-base leading-tight">{detail.title}</SheetTitle>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {detail.masteredConcepts}/{detail.totalConcepts} mastered
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {detail.extractionCount} sources
                      </Badge>
                    </div>
                    {detail.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {detail.description}
                      </p>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Linked Sources</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 gap-1 text-[10px]"
                    onClick={() => setLinkOpen(true)}
                  >
                    <Link2 className="h-3 w-3" />
                    Link Source
                  </Button>
                </div>

                {detail.extractions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No sources linked yet
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.extractions.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center gap-2 rounded-lg border border-border p-2.5"
                      >
                        <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-xs font-medium">
                            {link.extraction.title || 'Untitled'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {link.extraction._count.concepts} concepts ·{' '}
                            {link.source === 'ai' ? 'AI linked' : 'Manual'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnlink(link.extractionId)}
                          disabled={unlinkMutation.isPending}
                          className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 border-t border-border pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-foreground">AI insights</p>
                    </div>
                    {insights?.memoryCount ? (
                      <Badge variant="outline" className="text-[10px]">
                        {insights.memoryCount} memories
                      </Badge>
                    ) : null}
                  </div>

                  {insightsLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-14 w-full rounded-lg" />
                      <Skeleton className="h-16 w-full rounded-lg" />
                    </div>
                  ) : !insights ||
                    (insights.suggestedLinks.length === 0 &&
                      insights.weakAreas.length === 0 &&
                      insights.nextActions.length === 0) ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">
                      No memory-backed suggestions yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.weakAreas.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Weak areas
                          </p>
                          {insights.weakAreas.slice(0, 3).map((area, index) => (
                            <div
                              key={`${area.content}-${index}`}
                              className="rounded-lg bg-accent/60 px-3 py-2 text-xs text-foreground"
                            >
                              {area.content}
                            </div>
                          ))}
                        </div>
                      )}

                      {insights.suggestedLinks.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Suggested links
                          </p>
                          {insights.suggestedLinks.map((suggestion) => (
                            <div
                              key={suggestion.id}
                              className="rounded-lg border border-border p-2.5"
                            >
                              <div className="flex items-start gap-2">
                                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-1 text-xs font-medium">
                                    {suggestion.extraction?.title ?? 'Untitled source'}
                                  </p>
                                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    {suggestion.content}
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {Math.round(suggestion.confidence * 100)}% confidence
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 flex gap-1.5">
                                <Button
                                  size="sm"
                                  className="h-7 flex-1 text-[10px]"
                                  onClick={() => handleAcceptSuggestion(suggestion.id)}
                                  disabled={acceptSuggestionMutation.isPending}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px]"
                                  onClick={() => handleDismissSuggestion(suggestion.id)}
                                  disabled={dismissSuggestionMutation.isPending}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {insights.nextActions.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Next actions
                          </p>
                          {insights.nextActions.slice(0, 3).map((action, index) => (
                            <div
                              key={`${action.content}-${index}`}
                              className="flex gap-2 rounded-lg bg-accent/60 px-3 py-2 text-xs"
                            >
                              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <span>{action.content}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border px-6 py-4">
                {detail.status !== 'COMPLETED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleStatus('COMPLETED')}
                    disabled={updateMutation.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Complete
                  </Button>
                )}
                {detail.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleStatus('PAUSED')}
                    disabled={updateMutation.isPending}
                  >
                    <Pause className="h-3.5 w-3.5" />
                    Pause
                  </Button>
                )}
                {detail.status === 'PAUSED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => handleStatus('ACTIVE')}
                    disabled={updateMutation.isPending}
                  >
                    Resume
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {goalId && (
        <LinkExtractionDialog
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          goalId={goalId}
          linkedIds={linkedIds}
        />
      )}
    </>
  )
}

export function GoalTracker({ initialGoals }: GoalTrackerProps) {
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const { data: goals } = useGoals(initialGoals)

  const topGoals = (goals ?? []).filter((g) => g.status === 'ACTIVE').slice(0, 3)

  return (
    <>
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Path to Mastery</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Goal
            </Button>
          </div>

          {topGoals.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Brain className="mb-2 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No active goals yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">
                Add a goal to track your mastery progress
              </p>
              <Button size="sm" className="mt-3 text-xs" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add your first goal
              </Button>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-1">
              {topGoals.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => setSelectedGoalId(goal.id)}
                  className="flex min-w-[140px] flex-col items-center rounded-xl border border-border p-3 text-center transition-colors hover:border-primary/30 hover:bg-accent/50"
                >
                  <MiniProgressRing percent={goal.progressPercent} />
                  <p className="mt-2 line-clamp-1 text-xs font-medium">{goal.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {goal.masteredConcepts}/{goal.totalConcepts} concepts
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateGoalDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <GoalDetailSheet goalId={selectedGoalId} onClose={() => setSelectedGoalId(null)} />
    </>
  )
}
