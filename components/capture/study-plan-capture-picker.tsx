'use client'

import Link from 'next/link'
import { GraduationCap, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRoadmaps } from '@/lib/hooks/use-roadmap'
import { useCaptureStore } from '@/lib/stores/capture-store'

const NONE_VALUE = '__none__'

export function StudyPlanCapturePicker() {
  const { data: roadmaps, isLoading } = useRoadmaps()
  const selectedRoadmapId = useCaptureStore((s) => s.selectedRoadmapId)
  const setSelectedRoadmapId = useCaptureStore((s) => s.setSelectedRoadmapId)

  const activeRoadmaps = (roadmaps ?? []).filter((r) => r.status !== 'ARCHIVED')
  const current = selectedRoadmapId ?? NONE_VALUE

  function onChange(value: string | null) {
    if (!value || value === NONE_VALUE) {
      setSelectedRoadmapId(null)
    } else {
      setSelectedRoadmapId(value)
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Study Plan
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          Link captures to a plan so they count toward your progress.
        </p>
        {isLoading ? (
          <div className="h-8 w-full max-w-xs animate-pulse rounded-lg bg-muted" />
        ) : activeRoadmaps.length === 0 ? (
          <Link
            href="/roadmaps"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            Create your first study plan
          </Link>
        ) : (
          <Select value={current} onValueChange={onChange}>
            <SelectTrigger className="h-8 w-full max-w-xs text-xs">
              <SelectValue placeholder="None — save to library only">
                {(value: string | null) => {
                  if (!value || value === NONE_VALUE) return 'None — save to library only'
                  return activeRoadmaps.find((r) => r.id === value)?.title ?? 'None — save to library only'
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None — save to library only</SelectItem>
              {activeRoadmaps.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  )
}
