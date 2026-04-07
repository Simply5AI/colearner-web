'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { completeOnboarding, getOnboardingSuggestionStatus } from '@/lib/api/user'
import { queryKeys } from '@/lib/api/query-keys'
import { apiClient } from '@/lib/api/client'
import type { SuggestedGoal } from '@/lib/types'

export function SuggestionsReview() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const queryClient = useQueryClient()

  const { data: status, isLoading } = useQuery({
    queryKey: queryKeys.onboarding.suggestionStatus(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getOnboardingSuggestionStatus(session.accessToken)
    },
    enabled: !!session?.accessToken,
  })

  const [goals, setGoals] = useState<SuggestedGoal[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  useEffect(() => {
    if (status?.goals) {
      setGoals(status.goals)
    }
  }, [status])

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      await completeOnboarding(session.accessToken)
      await update({ onboardingCompleted: true })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() })
      router.push('/onboarding/welcome')
    },
    onError: () => {
      toast.error('Failed to complete onboarding')
    },
  })

  const handleAccept = (goalId: string) => {
    // Goal is already created in DB, just visual feedback
    toast.success('Goal accepted!')
  }

  const handleStartEdit = (goal: SuggestedGoal) => {
    setEditingId(goal.id)
    setEditTitle(goal.title)
  }

  const handleSaveEdit = async (goalId: string) => {
    if (!session?.accessToken || !editTitle.trim()) return

    try {
      await apiClient(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: { title: editTitle.trim() },
      })
      setGoals((prev) =>
        prev.map((g) => (g.id === goalId ? { ...g, title: editTitle.trim() } : g)),
      )
      setEditingId(null)
      toast.success('Goal updated')
    } catch {
      toast.error('Failed to update goal')
    }
  }

  const handleDismiss = async (goalId: string) => {
    if (!session?.accessToken) return

    try {
      await apiClient(`/api/goals/${goalId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: { status: 'ARCHIVED' },
      })
      setGoals((prev) => prev.filter((g) => g.id !== goalId))
      toast.success('Goal dismissed')
    } catch {
      toast.error('Failed to dismiss goal')
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-brand-orange" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">
          Here&apos;s your personalized learning plan!
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Based on your profile, we suggest these learning goals:
        </p>
      </div>

      {/* Goal cards */}
      <div className="space-y-3">
        {goals.map((goal) => (
          <div
            key={goal.id}
            className="rounded-lg border p-4 transition-colors hover:border-brand-orange/30"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{goal.icon || '\u{1F3AF}'}</span>
              <div className="flex-1 min-w-0">
                {editingId === goal.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="h-8 text-sm font-semibold"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(goal.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveEdit(goal.id)}
                      className="h-8 px-2"
                    >
                      <Check className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <h3 className="text-sm font-semibold">{goal.title}</h3>
                )}
                {goal.description && editingId !== goal.id && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {goal.description}
                  </p>
                )}
              </div>
            </div>

            {editingId !== goal.id && (
              <div className="flex gap-2 mt-3 ml-8">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAccept(goal.id)}
                  className="h-7 text-xs"
                >
                  <Check className="size-3 mr-1" /> Accept
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStartEdit(goal)}
                  className="h-7 text-xs"
                >
                  <Pencil className="size-3 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(goal.id)}
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3 mr-1" /> Dismiss
                </Button>
              </div>
            )}
          </div>
        ))}

        {goals.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No suggestions were generated. You can add goals later from your dashboard.
          </p>
        )}
      </div>

      {/* Roadmap indicator */}
      {status?.roadmapId && (
        <div className="rounded-lg border border-dashed p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{'\u{1F4CB}'}</span>
            <div>
              <p className="text-sm font-semibold">Starter Roadmap</p>
              <p className="text-xs text-muted-foreground">
                {status.roadmapStatus === 'GENERATING'
                  ? 'Generating your personalized roadmap...'
                  : 'Your roadmap is ready! View it from the dashboard.'}
              </p>
            </div>
            {status.roadmapStatus === 'GENERATING' && (
              <Loader2 className="size-4 animate-spin text-brand-orange ml-auto" />
            )}
          </div>
        </div>
      )}

      {/* Complete button */}
      <Button
        onClick={() => completeMutation.mutate()}
        disabled={completeMutation.isPending}
        className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
      >
        {completeMutation.isPending ? 'Finishing...' : 'Start Learning \u2192'}
      </Button>
    </div>
  )
}
