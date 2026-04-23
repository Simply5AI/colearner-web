'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, GraduationCap, Clock, Loader2, Trash2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useUnifiedRoadmaps, useCreateRoadmap, useDeleteRoadmap } from '@/lib/hooks/use-roadmap'
import { useDeleteGoal } from '@/lib/hooks/use-goals'
import { useLearnerTerms } from '@/lib/hooks/use-learner-terms'
import { CreateRoadmapModal } from './create-roadmap-modal'
import type { Goal, Roadmap, RoadmapStatus, RoadmapMode, StudyPlanListItem } from '@/lib/types'

const statusConfig: Record<RoadmapStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  GENERATING: { label: 'Generating...', variant: 'secondary' },
  ACTIVE: { label: 'Active', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'outline' },
  ARCHIVED: { label: 'Archived', variant: 'outline' },
}

const modeLabels: Record<RoadmapMode, string> = {
  TOPIC: 'Topic',
  SYLLABUS: 'Syllabus',
  EXAM_PREP: 'Exam Prep',
}

function getRoadmapProgress(roadmap: Roadmap) {
  const totalItems = roadmap.phases.reduce((sum, p) => sum + p.items.length, 0)
  const capturedItems = roadmap.phases.reduce(
    (sum, p) => sum + p.items.filter((i) => i.status === 'CAPTURED').length,
    0
  )

  return {
    totalItems,
    capturedItems,
    percent: totalItems > 0 ? (capturedItems / totalItems) * 100 : 0,
  }
}

function createGoalRecommendationItem(goal: Goal): StudyPlanListItem {
  return {
    type: 'goal_recommendation',
    id: goal.id,
    sortDate: goal.createdAt,
    roadmap: null,
    goal,
  }
}

function StudyPlanCard({ item }: { item: StudyPlanListItem }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const createRoadmap = useCreateRoadmap()
  const deleteRoadmap = useDeleteRoadmap()
  const deleteGoal = useDeleteGoal()
  const terms = useLearnerTerms()

  const isRoadmap = item.type === 'roadmap'
  const roadmap = item.roadmap
  const goal = item.goal
  const progress = roadmap ? getRoadmapProgress(roadmap) : null
  const config = roadmap ? statusConfig[roadmap.status] : null
  const canRemoveRoadmap = !!roadmap && progress?.capturedItems === 0 && roadmap.status !== 'GENERATING'
  const createdAt = new Date(item.sortDate).toLocaleDateString()
  const title = roadmap?.title ?? goal?.title ?? ''
  const description = roadmap?.description ?? goal?.description

  const handleOpen = () => {
    if (roadmap) {
      router.push(`/roadmaps/${roadmap.id}`)
    }
  }

  const handleGenerate = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!goal) return

    try {
      const result = await createRoadmap.mutateAsync({
        mode: 'TOPIC',
        topic: goal.title,
        goalId: goal.id,
      })
      toast.success(`${terms.planLabel} generation started`)
      router.push(`/roadmaps/${result.roadmap.id}`)
    } catch {
      toast.error(`Failed to generate ${terms.planLabel.toLowerCase()}`)
    }
  }

  const handleRemoveRoadmap = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!roadmap) return

    try {
      await deleteRoadmap.mutateAsync(roadmap.id)
      toast.success(`${terms.planLabel} removed`)
    } catch {
      toast.error(`Failed to remove ${terms.planLabel.toLowerCase()}`)
    }
  }

  const handleRemoveGoal = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!goal) return

    try {
      await deleteGoal.mutateAsync(goal.id)
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
      toast.success(`${terms.goalLabel} removed`)
    } catch {
      toast.error(`Failed to remove ${terms.goalLabel.toLowerCase()}`)
    }
  }

  return (
    <Card
      role={isRoadmap ? 'link' : undefined}
      tabIndex={isRoadmap ? 0 : undefined}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (isRoadmap && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleOpen()
        }
      }}
      className={`transition-shadow hover:shadow-md ${isRoadmap ? 'cursor-pointer' : ''}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <CardTitle className="text-lg">{title}</CardTitle>
          <div className="flex shrink-0 items-center gap-2">
            {roadmap ? (
              <>
                <Badge variant="outline" className="text-xs">{modeLabels[roadmap.mode]}</Badge>
                {config && <Badge variant={config.variant}>{config.label}</Badge>}
                {canRemoveRoadmap && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={handleRemoveRoadmap}
                    disabled={deleteRoadmap.isPending}
                    aria-label={`Remove ${terms.planLabel.toLowerCase()}`}
                  >
                    {deleteRoadmap.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                <Button
                  size="sm"
                  onClick={handleGenerate}
                  disabled={createRoadmap.isPending}
                >
                  {createRoadmap.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Generate {terms.planLabel}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={handleRemoveGoal}
                  disabled={deleteGoal.isPending}
                  aria-label={`Remove ${terms.goalLabel.toLowerCase()}`}
                >
                  {deleteGoal.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        )}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {roadmap ? (
            <>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {roadmap.totalPhases} phases
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {progress?.capturedItems ?? 0}/{progress?.totalItems ?? 0} captured
              </span>
              {roadmap.goal && (
                <span className="flex items-center gap-1">
                  {roadmap.goal.icon || '\u{1F3AF}'} {roadmap.goal.title}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI-ready recommendation
              </span>
              {goal && (
                <span className="flex items-center gap-1">
                  {goal.icon || '\u{1F3AF}'} {terms.goalLabel}
                </span>
              )}
            </>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {createdAt}
          </span>
        </div>
        {roadmap ? (
          progress && progress.totalItems > 0 && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          )
        ) : (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-1/3 rounded-full bg-primary/50" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function RoadmapsPageClient() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useUnifiedRoadmaps()
  const terms = useLearnerTerms()

  const fallbackStudyPlans: StudyPlanListItem[] = [
    ...(data?.goalsWithoutRoadmap ?? []).map(createGoalRecommendationItem),
    ...((data?.roadmaps ?? []).map((roadmap) => ({
      type: 'roadmap' as const,
      id: roadmap.id,
      sortDate: roadmap.createdAt,
      roadmap,
      goal: null,
    }))),
  ]
  const studyPlans = data?.studyPlans ?? fallbackStudyPlans

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {terms.newPlanLabel}
        </Button>
      </div>

      {studyPlans.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No {terms.plansLabel.toLowerCase()} yet</h3>
            <p className="mb-4 max-w-md text-sm text-muted-foreground">
              {terms.pageSubtitle}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First {terms.planLabel}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {studyPlans.map((item) => (
            <StudyPlanCard key={`${item.type}:${item.id}`} item={item} />
          ))}
        </div>
      )}

      <CreateRoadmapModal open={showCreate} onOpenChange={setShowCreate} />
    </>
  )
}
