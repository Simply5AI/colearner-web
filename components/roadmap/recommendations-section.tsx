'use client'

import { useEffect, useState } from 'react'
import { Globe, Loader2, RefreshCw, Sparkles, Youtube } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  useRecommendations,
  useGenerateRecommendations,
  useAcceptRecommendation,
  useDismissRecommendation,
} from '@/lib/hooks/use-roadmap'
import { useLearnerTerms } from '@/lib/hooks/use-learner-terms'
import type { Recommendation, RoadmapPhase } from '@/lib/types'

interface RecommendationsSectionProps {
  roadmapId: string
  phases: RoadmapPhase[]
  roadmapStatus: string
}

function RecommendationCard({
  rec,
  phases,
  roadmapId,
}: {
  rec: Recommendation
  phases: RoadmapPhase[]
  roadmapId: string
}) {
  const acceptMutation = useAcceptRecommendation(roadmapId)
  const dismissMutation = useDismissRecommendation(roadmapId)
  const terms = useLearnerTerms()

  const handleAccept = async () => {
    try {
      await acceptMutation.mutateAsync({ recommendationId: rec.id })
      toast.success(`Added to ${terms.planLabel.toLowerCase()}`)
    } catch {
      toast.error('Failed to add recommendation')
    }
  }

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync(rec.id)
    } catch {
      toast.error('Failed to dismiss')
    }
  }

  const isProcessing = acceptMutation.isPending || dismissMutation.isPending
  const addLabel = `Add to ${terms.planLabel}`

  return (
    <Card className="group">
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          {rec.sourceType === 'YOUTUBE' ? (
            <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0">YT</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 shrink-0">WEB</Badge>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{rec.title}</span>
              {rec.durationMin && (
                <span className="text-xs text-muted-foreground shrink-0">{rec.durationMin} min</span>
              )}
            </div>
            {rec.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{rec.description}</p>
            )}
            {rec.relevance && (
              <p className="text-xs text-primary/70 mt-1 italic">{rec.relevance}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={handleAccept}
              disabled={isProcessing}
              title={phases.length === 0 ? 'Creates a Recommended Resources section in this study plan' : undefined}
            >
              {acceptMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : addLabel}
            </Button>

            {rec.url && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
                render={<a href={rec.url} target="_blank" rel="noopener noreferrer" />}
              >
                {rec.sourceType === 'YOUTUBE' ? (
                  <Youtube className="h-3.5 w-3.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleDismiss}
              disabled={isProcessing}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RecommendationsSection({ roadmapId, phases, roadmapStatus }: RecommendationsSectionProps) {
  const { data: recommendations, isLoading, refetch } = useRecommendations(roadmapId)
  const generateMutation = useGenerateRecommendations(roadmapId)
  const [isWaitingForResults, setIsWaitingForResults] = useState(false)

  const generateRecommendations = () => {
    setIsWaitingForResults(true)
    generateMutation.mutate(undefined, {
      onSettled: () => {
        void refetch()
      },
    })
  }

  // Auto-generate on first view of ACTIVE roadmap with no recommendations
  useEffect(() => {
    if (
      roadmapStatus === 'ACTIVE' &&
      !isLoading &&
      recommendations !== undefined &&
      recommendations.length === 0 &&
      !generateMutation.isPending &&
      !generateMutation.isSuccess
    ) {
      generateRecommendations()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roadmapStatus, isLoading, recommendations?.length])

  useEffect(() => {
    if (!isWaitingForResults) return
    if (recommendations && recommendations.length > 0) {
      setIsWaitingForResults(false)
      return
    }

    const interval = window.setInterval(() => {
      void refetch()
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isWaitingForResults, recommendations, refetch])

  if (roadmapStatus !== 'ACTIVE') return null

  const isGenerating = generateMutation.isPending || (isWaitingForResults && (!recommendations || recommendations.length === 0))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">AI Recommendations</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={generateRecommendations}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>

      {(isLoading || isGenerating) && (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-3 py-6 justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Finding resources for you...
            </span>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isGenerating && recommendations && recommendations.length > 0 && (
        <div className="space-y-2">
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              phases={phases}
              roadmapId={roadmapId}
            />
          ))}
        </div>
      )}

      {!isLoading && !isGenerating && recommendations && recommendations.length === 0 && generateMutation.isSuccess && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-6 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No recommendations available yet</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 text-xs"
              onClick={generateRecommendations}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
