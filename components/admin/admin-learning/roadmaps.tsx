'use client'

import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'

import {
  getAdminLearningRoadmapDetail,
  type AdminLearningRoadmapDetail,
  type AdminLearningRoadmapsResponse,
  type AdminLearningUser,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AdminLearningLayout, CursorPager, DebouncedInput, EmptyState, formatDate, recordBadge, useLearningFilters } from './shared'

const ALL = 'all'

export function AdminLearningRoadmaps({
  data,
  user,
  authHeaders,
}: {
  data: AdminLearningRoadmapsResponse
  user: AdminLearningUser
  authHeaders: Record<string, string>
}) {
  const { params, setParam, clearParams, router } = useLearningFilters()
  const [detail, setDetail] = useState<AdminLearningRoadmapDetail | null>(null)
  const [open, setOpen] = useState(false)

  const hasGenerating = data.items.some((roadmap) => roadmap.status === 'GENERATING') || detail?.status === 'GENERATING'

  useEffect(() => {
    if (!hasGenerating) return
    const interval = window.setInterval(() => router.refresh(), 5000)
    return () => window.clearInterval(interval)
  }, [hasGenerating, router])

  const loadDetail = async (roadmapId: string) => {
    setOpen(true)
    setDetail(null)
    setDetail(await getAdminLearningRoadmapDetail(authHeaders, user.id, roadmapId))
  }

  return (
    <AdminLearningLayout user={user} active="roadmaps">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <DebouncedInput
          defaultValue={params.get('search') ?? ''}
          placeholder="Search roadmaps"
          onValue={(value) => setParam('search', value)}
        />
        <Select
          value={params.get('status') ?? ALL}
          onValueChange={(value) => setParam('status', value && value !== ALL ? value : '')}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Roadmap status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="GENERATING">Generating</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-9" onClick={clearParams}>
          Clear
        </Button>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Concepts</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((roadmap) => (
                  <tr key={roadmap.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{roadmap.title}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {recordBadge(roadmap.status)}
                        {roadmap.isGenerationSlow && <Badge variant="destructive">Generation slow</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-32 items-center gap-2">
                        <Progress value={roadmap.progressPercent} className="h-2" />
                        <span className="font-mono text-xs font-bold">{roadmap.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {roadmap.masteredConcepts}/{roadmap.totalConcepts}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(roadmap.generation.generatedAt)}</td>
                    <td className="px-4 py-3">{roadmap.generation.model ?? 'No data yet'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => loadDetail(roadmap.id)}>
                        <Eye className="h-3.5 w-3.5" />
                        View roadmap detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CursorPager nextCursor={data.nextCursor} />
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{detail?.title ?? 'Roadmap detail'}</SheetTitle>
          </SheetHeader>
          {!detail ? (
            <EmptyState>Loading roadmap...</EmptyState>
          ) : (
            <div className="space-y-5 px-4 pb-4">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {recordBadge(detail.status)}
                  {detail.isGenerationSlow && <Badge variant="destructive">Generation slow</Badge>}
                  <span className="font-mono text-sm font-bold">{detail.progressPercent}%</span>
                </div>
                <Progress value={detail.progressPercent} className="h-2" />
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>{detail.masteredConcepts}/{detail.totalConcepts} concepts mastered</span>
                  <span>Model: {detail.generation.model ?? 'No data yet'}</span>
                  <span>Prompt: {detail.generation.promptVersion ?? 'No data yet'}</span>
                  <span>Generated: {formatDate(detail.generation.generatedAt)}</span>
                  <span>Duration: {formatMilliseconds(detail.generation.durationMs)}</span>
                  <span>Subject: {detail.subject?.name ?? 'No data yet'}</span>
                </div>
              </div>

              <section>
                <div className="mb-2 text-sm font-bold">Roadmap phases</div>
                {detail.phases.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3">
                    {detail.phases.map((phase) => (
                      <div key={phase.id} className="rounded-lg border p-3 [content-visibility:auto]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{phase.title}</div>
                            {phase.description && <div className="text-xs text-muted-foreground">{phase.description}</div>}
                          </div>
                          <Badge variant="outline">{phase.items.length} items</Badge>
                        </div>
                        {phase.items.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {phase.items.map((item) => (
                              <div key={item.id} className="rounded-lg bg-muted/40 p-2 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">{item.title}</span>
                                  {recordBadge(item.status)}
                                  <Badge variant="outline">{item.sourceType.toLowerCase()}</Badge>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {item.extraction?.title ?? 'No extraction linked'}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-2 text-sm font-bold">Concept tree</div>
                {detail.concepts.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-2">
                    {detail.concepts.map((concept) => (
                      <div key={concept.id} className="rounded-lg border p-3 [content-visibility:auto]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{concept.title}</div>
                            <div className="text-xs text-muted-foreground">{concept.phase?.title ?? 'No phase'}</div>
                            {concept.description && <div className="mt-1 text-xs text-muted-foreground">{concept.description}</div>}
                          </div>
                          {recordBadge(concept.masteryState)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}

function formatMilliseconds(value: number | null) {
  if (value === null) return 'No data yet'
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(1)}s`
}
