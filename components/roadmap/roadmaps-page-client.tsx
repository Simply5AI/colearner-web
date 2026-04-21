'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, BookOpen, GraduationCap, Clock, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useUnifiedRoadmaps, useCreateRoadmap, useDeleteRoadmap } from '@/lib/hooks/use-roadmap'
import { useDeleteGoal } from '@/lib/hooks/use-goals'
import { useLearnerTerms } from '@/lib/hooks/use-learner-terms'
import { CreateRoadmapModal } from './create-roadmap-modal'
import type { Roadmap, Goal, RoadmapStatus, RoadmapMode } from '@/lib/types'

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

function RoadmapCard({ roadmap }: { roadmap: Roadmap }) {
  const deleteMutation = useDeleteRoadmap()
  const terms = useLearnerTerms()
  const totalItems = roadmap.phases.reduce((sum, p) => sum + p.items.length, 0)
  const capturedItems = roadmap.phases.reduce(
    (sum, p) => sum + p.items.filter((i) => i.status === 'CAPTURED').length,
    0
  )
  const config = statusConfig[roadmap.status]
  const canRemove = capturedItems === 0 && roadmap.status !== 'GENERATING'

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await deleteMutation.mutateAsync(roadmap.id)
      toast.success(`${terms.planLabel} removed`)
    } catch {
      toast.error(`Failed to remove ${terms.planLabel.toLowerCase()}`)
    }
  }

  return (
    <Link href={`/roadmaps/${roadmap.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{roadmap.title}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{modeLabels[roadmap.mode]}</Badge>
              <Badge variant={config.variant}>{config.label}</Badge>
              {canRemove && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  onClick={handleRemove}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {roadmap.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{roadmap.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              {roadmap.totalPhases} phases
            </span>
            <span className="flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              {capturedItems}/{totalItems} captured
            </span>
            {roadmap.goal && (
              <span className="flex items-center gap-1">
                {roadmap.goal.icon || '🎯'} {roadmap.goal.title}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(roadmap.createdAt).toLocaleDateString()}
            </span>
          </div>
          {totalItems > 0 && (
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${(capturedItems / totalItems) * 100}%` }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function OrphanGoalCard({ goal }: { goal: Goal }) {
  const createRoadmap = useCreateRoadmap()
  const deleteGoal = useDeleteGoal()
  const queryClient = useQueryClient()
  const terms = useLearnerTerms()

  const handleGenerate = async () => {
    await createRoadmap.mutateAsync({
      mode: 'TOPIC',
      topic: goal.title,
      goalId: goal.id,
    })
  }

  const handleRemoveGoal = async () => {
    try {
      await deleteGoal.mutateAsync(goal.id)
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] })
      toast.success(`${terms.goalLabel} removed`)
    } catch {
      toast.error(`Failed to remove ${terms.goalLabel.toLowerCase()}`)
    }
  }

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardContent className="flex items-center justify-between py-4 px-5">
        <div className="flex items-center gap-3">
          <span className="text-xl">{goal.icon || '\u{1F3AF}'}</span>
          <div>
            <p className="font-medium text-sm">{goal.title}</p>
            {goal.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{goal.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={createRoadmap.isPending}
          >
            {createRoadmap.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Generate {terms.planLabel}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={handleRemoveGoal}
            disabled={deleteGoal.isPending}
          >
            {deleteGoal.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function RoadmapsPageClient() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading } = useUnifiedRoadmaps()
  const terms = useLearnerTerms()

  const roadmaps = data?.roadmaps ?? []
  const orphanGoals = data?.goalsWithoutRoadmap ?? []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hasContent = roadmaps.length > 0 || orphanGoals.length > 0

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {terms.newPlanLabel}
        </Button>
      </div>

      {!hasContent ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No {terms.plansLabel.toLowerCase()} yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {terms.pageSubtitle}
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First {terms.planLabel}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orphanGoals.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {terms.goalsLabel} without {terms.plansLabel.toLowerCase()}
              </p>
              {orphanGoals.map((goal) => (
                <OrphanGoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}

          {roadmaps.length > 0 && (
            <div className="space-y-4">
              {orphanGoals.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Your {terms.plansLabel}
                </p>
              )}
              {roadmaps.map((roadmap) => (
                <RoadmapCard key={roadmap.id} roadmap={roadmap} />
              ))}
            </div>
          )}
        </div>
      )}

      <CreateRoadmapModal open={showCreate} onOpenChange={setShowCreate} />
    </>
  )
}
