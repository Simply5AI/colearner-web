'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Loader2,
  Play,
  SkipForward,
  Globe,
  CheckCircle2,
  Clock,
  Archive,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  useRoadmap,
  useCaptureRoadmapItem,
  useSkipRoadmapItem,
  useDeleteRoadmap,
} from '@/lib/hooks/use-roadmap'
import { getApiUrl } from '@/lib/api/client'
import type { RoadmapItem, RoadmapItemStatus, RoadmapWeek } from '@/lib/types'

const itemStatusConfig: Record<RoadmapItemStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: 'Pending', icon: Clock, className: 'text-muted-foreground' },
  QUEUED: { label: 'Queued', icon: Loader2, className: 'text-blue-500' },
  CAPTURED: { label: 'Captured', icon: CheckCircle2, className: 'text-green-600' },
  SKIPPED: { label: 'Skipped', icon: SkipForward, className: 'text-muted-foreground' },
}

function SourceBadge({ type }: { type: string }) {
  if (type === 'YOUTUBE') {
    return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">YT</Badge>
  }
  return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">WEB</Badge>
}

function RoadmapItemCard({
  item,
  roadmapId,
}: {
  item: RoadmapItem
  roadmapId: string
}) {
  const captureItem = useCaptureRoadmapItem(roadmapId)
  const skipItem = useSkipRoadmapItem(roadmapId)
  const config = itemStatusConfig[item.status]
  const StatusIcon = config.icon

  return (
    <Card className="group">
      <CardContent className="flex items-start gap-3 py-3 px-4">
        <SourceBadge type={item.sourceType} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{item.title}</span>
            {item.durationMin && (
              <span className="text-xs text-muted-foreground shrink-0">{item.durationMin} min</span>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`flex items-center gap-1 text-xs ${config.className}`}>
            <StatusIcon className={`h-3.5 w-3.5 ${item.status === 'QUEUED' ? 'animate-spin' : ''}`} />
            {config.label}
          </span>

          {item.status === 'PENDING' && item.url && (
            <>
              <Button
                size="sm"
                variant="default"
                className="h-7 text-xs"
                onClick={() => captureItem.mutate(item.id)}
                disabled={captureItem.isPending}
              >
                {captureItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                Capture
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => skipItem.mutate(item.id)}
                disabled={skipItem.isPending}
              >
                Skip
              </Button>
            </>
          )}

          {item.status === 'CAPTURED' && item.extractionId && (
            <Button size="sm" variant="outline" className="h-7 text-xs" render={<Link href={`/extract?id=${item.extractionId}`} />}>
              View <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          )}

          {item.url && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" render={<a href={item.url} target="_blank" rel="noopener noreferrer" />}>
              <Globe className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function WeekSection({ week, roadmapId }: { week: RoadmapWeek; roadmapId: string }) {
  const captured = week.items.filter((i) => i.status === 'CAPTURED').length
  const total = week.items.length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-sm">{week.title}</h3>
        <span className="text-xs text-muted-foreground">
          {captured}/{total} captured
        </span>
      </div>
      {week.description && (
        <p className="text-xs text-muted-foreground">{week.description}</p>
      )}
      <div className="space-y-2">
        {week.items.map((item) => (
          <RoadmapItemCard key={item.id} item={item} roadmapId={roadmapId} />
        ))}
      </div>
    </div>
  )
}

export function RoadmapDetailClient({ roadmapId }: { roadmapId: string }) {
  const router = useRouter()
  const { data: roadmap, isLoading, refetch } = useRoadmap(roadmapId)
  const deleteRoadmap = useDeleteRoadmap()
  const [isPolling, setIsPolling] = useState(false)

  // Poll while GENERATING
  useEffect(() => {
    if (roadmap?.status !== 'GENERATING') {
      setIsPolling(false)
      return
    }

    setIsPolling(true)
    const interval = setInterval(() => refetch(), 3000)
    return () => clearInterval(interval)
  }, [roadmap?.status, refetch])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!roadmap) {
    return <p className="text-center text-muted-foreground py-12">Roadmap not found</p>
  }

  const totalItems = roadmap.weeks.reduce((s, w) => s + w.items.length, 0)
  const capturedItems = roadmap.weeks.reduce(
    (s, w) => s + w.items.filter((i) => i.status === 'CAPTURED').length,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" render={<Link href="/roadmaps" />}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Roadmaps
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{roadmap.title}</h1>
          {roadmap.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{roadmap.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{roadmap.totalWeeks} weeks</span>
            <span>{totalItems} resources</span>
            <span>{capturedItems} captured</span>
            {roadmap.goal && <span>Goal: {roadmap.goal.title}</span>}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await deleteRoadmap.mutateAsync(roadmapId)
            router.push('/roadmaps')
          }}
        >
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
      </div>

      {roadmap.status === 'GENERATING' && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              AI is generating your roadmap... This may take 15-30 seconds.
            </span>
          </CardContent>
        </Card>
      )}

      {totalItems > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${(capturedItems / totalItems) * 100}%` }}
          />
        </div>
      )}

      <div className="space-y-8">
        {roadmap.weeks.map((week) => (
          <WeekSection key={week.id} week={week} roadmapId={roadmapId} />
        ))}
      </div>
    </div>
  )
}
