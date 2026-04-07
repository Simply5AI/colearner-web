'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, BookOpen, GraduationCap, Clock, Archive, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRoadmaps, useDeleteRoadmap } from '@/lib/hooks/use-roadmap'
import { CreateRoadmapModal } from './create-roadmap-modal'
import type { Roadmap, RoadmapStatus, RoadmapMode } from '@/lib/types'

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
  const totalItems = roadmap.weeks.reduce((sum, w) => sum + w.items.length, 0)
  const capturedItems = roadmap.weeks.reduce(
    (sum, w) => sum + w.items.filter((i) => i.status === 'CAPTURED').length,
    0
  )
  const config = statusConfig[roadmap.status]

  return (
    <Link href={`/roadmaps/${roadmap.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{roadmap.title}</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">{modeLabels[roadmap.mode]}</Badge>
              <Badge variant={config.variant}>{config.label}</Badge>
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
              {roadmap.totalWeeks} weeks
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

export function RoadmapsPageClient() {
  const [showCreate, setShowCreate] = useState(false)
  const { data: roadmaps, isLoading } = useRoadmaps()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Roadmap
        </Button>
      </div>

      {!roadmaps?.length ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No roadmaps yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Create an AI-generated learning path, import your course syllabus, or build an exam prep plan.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Roadmap
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {roadmaps.map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} />
          ))}
        </div>
      )}

      <CreateRoadmapModal open={showCreate} onOpenChange={setShowCreate} />
    </>
  )
}
