import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { GraduationCap, ArrowRight } from 'lucide-react'
import type { Roadmap, RoadmapStatus } from '@/lib/types'

interface StudyPlansSectionProps {
  roadmaps: Roadmap[]
}

const statusVariant: Record<RoadmapStatus, 'default' | 'secondary' | 'outline'> = {
  GENERATING: 'secondary',
  ACTIVE: 'default',
  COMPLETED: 'outline',
  ARCHIVED: 'outline',
}

function progressForRoadmap(roadmap: Roadmap) {
  const totalItems = roadmap.phases.reduce((sum, p) => sum + p.items.length, 0)
  const capturedItems = roadmap.phases.reduce(
    (sum, p) => sum + p.items.filter((i) => i.status === 'CAPTURED').length,
    0
  )
  const pct = totalItems > 0 ? Math.round((capturedItems / totalItems) * 100) : 0
  return { totalItems, capturedItems, pct }
}

export function StudyPlansSection({ roadmaps }: StudyPlansSectionProps) {
  const visible = roadmaps
    .filter((r) => r.status !== 'ARCHIVED')
    .slice(0, 3)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          <GraduationCap className="h-4 w-4 text-primary" />
          Your Study Plans
        </h2>
        <Link
          href="/roadmaps"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((roadmap) => {
          const { totalItems, capturedItems, pct } = progressForRoadmap(roadmap)
          return (
            <Link key={roadmap.id} href={`/roadmaps/${roadmap.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-sm">
                      {roadmap.title}
                    </CardTitle>
                    <Badge
                      variant={statusVariant[roadmap.status]}
                      className="shrink-0 text-[10px]"
                    >
                      {roadmap.status === 'GENERATING'
                        ? 'Generating'
                        : roadmap.status.charAt(0) + roadmap.status.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {capturedItems} / {totalItems} items
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      {pct}%
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
