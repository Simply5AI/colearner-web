'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Plus, BookOpen, GraduationCap, Clock, Loader2, Trash2, Sparkles, Upload, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useUnifiedRoadmaps, useCreateRoadmap, useDeleteRoadmap } from '@/lib/hooks/use-roadmap'
import { useDeleteGoal } from '@/lib/hooks/use-goals'
import { useLearnerTerms } from '@/lib/hooks/use-learner-terms'
import { useProfile } from '@/lib/hooks/use-profile'
import { useCreateCustomSubject, useSubjects, useUpdateOnboardingSubjects } from '@/lib/hooks/use-onboarding'
import { getDisplaySubjects } from '@/lib/constants/subjects'
import { cn } from '@/lib/utils'
import { CreateRoadmapModal } from './create-roadmap-modal'
import type { Goal, Roadmap, RoadmapStatus, RoadmapMode, StudyPlanListItem, SubjectItem } from '@/lib/types'

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
                {!terms.isStudent && <Badge variant="outline" className="text-xs">{modeLabels[roadmap.mode]}</Badge>}
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
                {roadmap.totalPhases} {terms.phasesLabel.toLowerCase()}
              </span>
              <span className="flex items-center gap-1">
                <GraduationCap className="h-3 w-3" />
                {progress?.totalItems ?? 0} {terms.isStudent ? 'study resources' : 'topics'} · {progress?.capturedItems ?? 0} captured
              </span>
              {roadmap.goal && (
                <span className="flex items-center gap-1">
                  {roadmap.goal.icon || '\u{1F3AF}'} {roadmap.goal.title}
                </span>
              )}
              {roadmap.subject && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" />
                  {roadmap.subject.name}
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

function StudentSubjectsSection({
  subjects,
}: {
  subjects: SubjectItem[]
}) {
  const router = useRouter()

  return (
    <section className="mb-6 space-y-3">
      <div>
        <h2 className="text-base font-semibold">My Subjects</h2>
        <p className="text-sm text-muted-foreground">
          Use a subject when it helps, or save anything uncategorized to All Captures.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Captures</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push('/capture?subject=all')}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Capture
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push('/recall')}>
              <Brain className="mr-1.5 h-3.5 w-3.5" />
              Practice
            </Button>
          </CardContent>
        </Card>
        {subjects.map((subject) => (
          <Card key={subject.id} className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{subject.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push(`/capture?subject=${subject.id}`)}>
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Capture
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push(`/recall?subject=${subject.id}`)}>
                <Brain className="mr-1.5 h-3.5 w-3.5" />
                Practice
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function StudentSubjectsDialog({
  open,
  onOpenChange,
  selectedSubjects,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedSubjects: SubjectItem[]
}) {
  const { data: subjects = [] } = useSubjects()
  const updateSubjects = useUpdateOnboardingSubjects()
  const createCustomSubject = useCreateCustomSubject()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customSubjectName, setCustomSubjectName] = useState('')
  const displaySubjects = getDisplaySubjects(subjects)

  useEffect(() => {
    if (open) {
      setSelectedIds(selectedSubjects.map((subject) => subject.id))
      setCustomSubjectName('')
    }
  }, [open, selectedSubjects])

  function toggleSubject(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  async function saveSubjects() {
    try {
      const nextIds = [...selectedIds]
      const trimmedCustomName = customSubjectName.trim()
      if (trimmedCustomName) {
        const customSubject = await createCustomSubject.mutateAsync({ name: trimmedCustomName })
        if (!nextIds.includes(customSubject.id)) nextIds.push(customSubject.id)
      }
      await updateSubjects.mutateAsync(nextIds)
      toast.success('Subjects updated')
      onOpenChange(false)
    } catch {
      toast.error('Could not update subjects')
    }
  }

  const isSaving = updateSubjects.isPending || createCustomSubject.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Subjects</DialogTitle>
          <DialogDescription>
            Choose school subjects or add your own interests. Captures and practice will stay organized under these subjects.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="custom-subject-name">
            Add your own subject or interest
          </label>
          <Input
            id="custom-subject-name"
            value={customSubjectName}
            onChange={(event) => setCustomSubjectName(event.target.value)}
            placeholder="e.g., Robotics, Drawing, Chess"
          />
        </div>
        <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {displaySubjects.map((subject) => {
            const isSelected = selectedIds.includes(subject.id)
            return (
              <button
                key={subject.id}
                type="button"
                onClick={() => toggleSubject(subject.id)}
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  isSelected
                    ? 'border-brand-orange bg-brand-orange/5'
                    : 'border-border hover:border-brand-orange/40',
                )}
              >
                <Checkbox
                  checked={isSelected}
                  className="pointer-events-none border-brand-orange data-checked:bg-brand-orange"
                />
                <span className="min-w-0 text-sm font-medium">{subject.name}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={saveSubjects} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Subjects
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function RoadmapsPageClient() {
  const [showCreate, setShowCreate] = useState(false)
  const [showSubjects, setShowSubjects] = useState(false)
  const { data, isLoading } = useUnifiedRoadmaps()
  const terms = useLearnerTerms()
  const { data: profile } = useProfile()
  const isStudent = profile?.learnerType === 'STUDENT'
  const studentSubjects = profile?.subjects ?? []

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
      <div className="sticky top-0 z-10 -mx-7 -mt-7 mb-6 border-b bg-background/80 px-7 pb-4 pt-7 backdrop-blur-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{terms.plansLabel}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {terms.pageSubtitle}
            </p>
          </div>
          <Button onClick={() => (isStudent ? setShowSubjects(true) : setShowCreate(true))}>
            <Plus className="mr-2 h-4 w-4" />
            {isStudent ? 'Add Subject' : terms.newPlanLabel}
          </Button>
        </div>
      </div>

      {isStudent && (
        <StudentSubjectsSection subjects={studentSubjects} />
      )}

      {!isStudent && (
        studyPlans.length === 0 ? (
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
        )
      )}

      {!isStudent && <CreateRoadmapModal open={showCreate} onOpenChange={setShowCreate} />}
      {isStudent && (
        <StudentSubjectsDialog
          open={showSubjects}
          onOpenChange={setShowSubjects}
          selectedSubjects={studentSubjects}
        />
      )}
    </>
  )
}
