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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AdminLearningLayout, CursorPager, DebouncedInput, EmptyState, formatDate, recordBadge, useLearningFilters } from './shared'

export function AdminLearningRoadmaps({
  data,
  user,
  authHeaders,
}: {
  data: AdminLearningRoadmapsResponse
  user: AdminLearningUser
  authHeaders: Record<string, string>
}) {
  const { params, setParam, router } = useLearningFilters()
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
        <select
          aria-label="Roadmap status"
          value={params.get('status') ?? ''}
          onChange={(event) => setParam('status', event.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="GENERATING">Generating</option>
          <option value="ACTIVE">Active</option>
          <option value="COMPLETED">Completed</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        {data.items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
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
                    <td className="px-4 py-3">{roadmap.totalConcepts}</td>
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
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{detail?.title ?? 'Roadmap detail'}</SheetTitle>
          </SheetHeader>
          {!detail ? (
            <EmptyState>Loading roadmap...</EmptyState>
          ) : (
            <div className="space-y-4 px-4 pb-4">
              <div className="rounded-lg border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {recordBadge(detail.status)}
                  {detail.isGenerationSlow && <Badge variant="destructive">Generation slow</Badge>}
                  <span className="font-mono text-sm font-bold">{detail.progressPercent}%</span>
                </div>
                <Progress value={detail.progressPercent} className="h-2" />
                <div className="mt-2 text-xs text-muted-foreground">
                  Model {detail.generation.model ?? 'No data yet'} · Generated {formatDate(detail.generation.generatedAt)}
                </div>
              </div>

              <div>
                <div className="mb-2 text-sm font-bold">Concept tree</div>
                {detail.concepts.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-2">
                    {detail.concepts.map((concept) => (
                      <div key={concept.id} className="rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{concept.title}</div>
                            <div className="text-xs text-muted-foreground">{concept.phase?.title ?? 'No phase'}</div>
                          </div>
                          {recordBadge(concept.masteryState)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}
