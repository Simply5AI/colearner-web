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
  Plus,
  SkipForward,
  Globe,
  Youtube,
  CheckCircle2,
  Clock,
  Archive,
  Trash2,
  AlertCircle,
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
import { useLearnerTerms } from '@/lib/hooks/use-learner-terms'
import { RecommendationsSection } from './recommendations-section'
import { getApiUrl } from '@/lib/api/client'
import type { RoadmapItem, RoadmapItemDisplayStatus, RoadmapPhase } from '@/lib/types'

const itemStatusConfig: Record<RoadmapItemDisplayStatus, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: 'Pending', icon: Clock, className: 'text-muted-foreground' },
  QUEUED: { label: 'Queued', icon: Loader2, className: 'text-blue-500' },
  CAPTURED: { label: 'Captured', icon: CheckCircle2, className: 'text-green-600' },
  SKIPPED: { label: 'Skipped', icon: SkipForward, className: 'text-muted-foreground' },
  FAILED: { label: 'Failed', icon: AlertCircle, className: 'text-destructive' },
}

function SourceBadge({ type }: { type: string }) {
  if (type === 'YOUTUBE') {
    return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">YT</Badge>
  }
  return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">WEB</Badge>
}

/** Direct video/article URL that the extraction pipeline can process */
function isCapturableUrl(url: string | null, sourceType: string): boolean {
  if (!url) return false
  if (sourceType === 'YOUTUBE') {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/')
  }
  return true // WEB URLs are capturable
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
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [manualUrl, setManualUrl] = useState('')
  const displayStatus: RoadmapItemDisplayStatus = item.extraction?.status === 'FAILED'
    || item.metadata?.extractionFailed === true
    ? 'FAILED'
    : item.status
  const config = itemStatusConfig[displayStatus]
  const StatusIcon = config.icon
  const capturable = isCapturableUrl(item.url, item.sourceType)
  const captures = (item.metadata?.captures as Array<{ extractionId: string; url: string }>) || []

  const handleCapture = () => {
    captureItem.mutate({ itemId: item.id })
  }

  const handleManualCapture = () => {
    if (!manualUrl.trim()) return
    captureItem.mutate({ itemId: item.id, url: manualUrl.trim() }, {
      onSuccess: () => {
        setShowUrlInput(false)
        setManualUrl('')
      },
    })
  }

  return (
    <Card className="group">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
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
              <StatusIcon className={`h-3.5 w-3.5 ${displayStatus === 'QUEUED' ? 'animate-spin' : ''}`} />
              {config.label}
            </span>

            {(item.status === 'PENDING' || displayStatus === 'FAILED') && capturable && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 text-xs"
                  onClick={handleCapture}
                  disabled={captureItem.isPending}
                >
                  {captureItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  {displayStatus === 'FAILED' ? 'Retry' : 'Capture'}
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

            {(item.status === 'PENDING' || displayStatus === 'FAILED') && !capturable && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  disabled={captureItem.isPending}
                >
                  {captureItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                  {displayStatus === 'FAILED' ? 'Retry' : 'Capture'}
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

            {item.status === 'CAPTURED' && (
              <>
                {item.extractionId && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" render={<Link href={`/extract?id=${item.extractionId}`} />}>
                    View <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {captures.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">{captures.length} sources</span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  disabled={captureItem.isPending}
                >
                  <Plus className="h-3 w-3" /> Add Source
                </Button>
              </>
            )}

          {item.url && (
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" render={<a href={item.url} target="_blank" rel="noopener noreferrer" />}>
              {item.sourceType === 'YOUTUBE' ? (
                <Youtube className="h-3.5 w-3.5" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          </div>
        </div>

        {displayStatus === 'FAILED' && (
          <p className="mt-2 border-t pt-2 text-xs text-destructive">
            Capture failed. You can retry this resource or open the link and add a better source.
          </p>
        )}

        {showUrlInput && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="Paste the URL of the video or article you studied..."
              className="flex-1 h-8 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onKeyDown={(e) => { if (e.key === 'Enter') handleManualCapture() }}
            />
            <Button
              size="sm"
              variant="default"
              className="h-8 text-xs"
              onClick={handleManualCapture}
              disabled={!manualUrl.trim() || captureItem.isPending}
            >
              {captureItem.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
              Capture
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => { setShowUrlInput(false); setManualUrl('') }}
            >
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PhaseSection({ phase, roadmapId }: { phase: RoadmapPhase; roadmapId: string }) {
  const captured = phase.items.filter((i) => i.status === 'CAPTURED').length
  const total = phase.items.length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <h3 className="font-semibold text-sm">{phase.title}</h3>
        <span className="text-xs text-muted-foreground">
          {captured}/{total} captured
        </span>
      </div>
      {phase.description && (
        <p className="text-xs text-muted-foreground">{phase.description}</p>
      )}
      <div className="space-y-2">
        {phase.items.map((item) => (
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
  const terms = useLearnerTerms()
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

  const totalItems = roadmap.phases.reduce((s, p) => s + p.items.length, 0)
  const capturedItems = roadmap.phases.reduce(
    (s, p) => s + p.items.filter((i) => i.status === 'CAPTURED').length,
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" render={<Link href="/roadmaps" />}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {terms.plansLabel}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{roadmap.title}</h1>
          {roadmap.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{roadmap.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{roadmap.totalPhases} {terms.phasesLabel.toLowerCase()}</span>
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
        {roadmap.phases.map((phase) => (
          <PhaseSection key={phase.id} phase={phase} roadmapId={roadmapId} />
        ))}
      </div>

      <RecommendationsSection
        roadmapId={roadmapId}
        phases={roadmap.phases}
        roadmapStatus={roadmap.status}
      />
    </div>
  )
}
