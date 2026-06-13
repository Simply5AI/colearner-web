'use client'

import { useEffect, useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'

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
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AdminLearningLayout,
  CursorPager,
  DebouncedInput,
  EmptyState,
  formatDate,
  LearningDataSection,
  LearningFiltersCard,
  LearningPageIntro,
  recordBadge,
  useLearningFilters,
} from './shared'

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

  const hasGenerating =
    data.items.some((roadmap) => roadmap.status === 'GENERATING') || detail?.status === 'GENERATING'

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
      <LearningPageIntro
        title="Study roadmaps"
        description="AI-generated study plans with phases, linked extractions, and concept mastery progress."
      />

      {hasGenerating && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-amber-700" />
          <p>
            <span className="font-medium text-amber-900 dark:text-amber-200">Roadmap generating</span>
            <span className="text-amber-800/80 dark:text-amber-200/80">
              {' '}
              — this page refreshes every 5 seconds until generation completes.
            </span>
          </p>
        </div>
      )}

      <LearningFiltersCard>
        <label className="min-w-[220px] flex-1 text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Search</Label>
          <DebouncedInput
            defaultValue={params.get('search') ?? ''}
            placeholder="Search roadmaps"
            onValue={(value) => setParam('search', value)}
          />
        </label>

        <label className="text-sm">
          <Label className="mb-1.5 block text-muted-foreground">Status</Label>
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
        </label>

        <Button variant="ghost" size="sm" className="h-9" onClick={clearParams}>
          Clear filters
        </Button>
      </LearningFiltersCard>

      <LearningDataSection
        title="Roadmaps"
        description={`${data.items.length} roadmaps on this page`}
      >
        {data.items.length === 0 ? (
          <EmptyState hint="Roadmaps are created from goals or manual generation in the product.">
            No roadmaps found
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3 text-right">Concepts</th>
                  <th className="px-4 py-3">Generated</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((roadmap) => (
                  <tr
                    key={roadmap.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{roadmap.title}</div>
                      {roadmap.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {roadmap.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {recordBadge(roadmap.status)}
                        {roadmap.isGenerationSlow && (
                          <Badge variant="destructive">Slow generation</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-32 items-center gap-2">
                        <Progress value={roadmap.progressPercent} className="h-2" />
                        <span className="font-mono text-xs font-bold">{roadmap.progressPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {roadmap.masteredConcepts}/{roadmap.totalConcepts}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(roadmap.generation.generatedAt)}
                    </td>
                    <td className="px-4 py-3">{roadmap.generation.model ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => loadDetail(roadmap.id)}
                        aria-label="View roadmap detail"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <CursorPager nextCursor={data.nextCursor} />
      </LearningDataSection>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>{detail?.title ?? 'Roadmap detail'}</SheetTitle>
            <SheetDescription>
              Generation metadata, phases, linked extractions, and concept mastery.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            {!detail ? (
              <EmptyState>Loading roadmap…</EmptyState>
            ) : (
              <div className="space-y-5">
                <div className="rounded-xl border border-border/70 bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {recordBadge(detail.status)}
                    {detail.isGenerationSlow && (
                      <Badge variant="destructive">Generation slow</Badge>
                    )}
                    <span className="font-mono text-sm font-bold">{detail.progressPercent}%</span>
                  </div>
                  <Progress value={detail.progressPercent} className="h-2" />
                  <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                    <MetaItem label="Concepts mastered" value={`${detail.masteredConcepts}/${detail.totalConcepts}`} />
                    <MetaItem label="Model" value={detail.generation.model ?? '—'} />
                    <MetaItem label="Prompt version" value={detail.generation.promptVersion ?? '—'} />
                    <MetaItem label="Generated" value={formatDate(detail.generation.generatedAt)} />
                    <MetaItem label="Duration" value={formatMilliseconds(detail.generation.durationMs)} />
                    <MetaItem label="Subject" value={detail.subject?.name ?? '—'} />
                    <MetaItem label="Goal" value={detail.goal?.title ?? '—'} className="sm:col-span-2" />
                  </dl>
                </div>

                <Tabs defaultValue="phases" className="space-y-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="phases">Phases ({detail.phases.length})</TabsTrigger>
                    <TabsTrigger value="concepts">Concepts ({detail.concepts.length})</TabsTrigger>
                  </TabsList>

                  <TabsContent value="phases" className="mt-0 space-y-3">
                    {detail.phases.length === 0 ? (
                      <EmptyState>No phases yet</EmptyState>
                    ) : (
                      detail.phases.map((phase) => (
                        <div
                          key={phase.id}
                          className="rounded-xl border border-border/70 bg-card p-4 [content-visibility:auto]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{phase.title}</div>
                              {phase.description && (
                                <p className="mt-1 text-xs text-muted-foreground">{phase.description}</p>
                              )}
                            </div>
                            <Badge variant="outline">{phase.items.length} items</Badge>
                          </div>
                          {phase.items.length > 0 && (
                            <ul className="mt-3 space-y-2">
                              {phase.items.map((item) => (
                                <li
                                  key={item.id}
                                  className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium">{item.title}</span>
                                    {recordBadge(item.status)}
                                    <Badge variant="outline">{item.sourceType.toLowerCase()}</Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {item.extraction?.title ?? 'No extraction linked'}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="concepts" className="mt-0 space-y-2">
                    {detail.concepts.length === 0 ? (
                      <EmptyState>No concepts linked</EmptyState>
                    ) : (
                      detail.concepts.map((concept) => (
                        <div
                          key={concept.id}
                          className="rounded-xl border border-border/70 bg-card p-4 [content-visibility:auto]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold">{concept.title}</div>
                              <p className="text-xs text-muted-foreground">
                                {concept.phase?.title ?? 'No phase'}
                              </p>
                              {concept.description && (
                                <p className="mt-1 text-xs text-muted-foreground">{concept.description}</p>
                              )}
                            </div>
                            {recordBadge(concept.masteryState)}
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </AdminLearningLayout>
  )
}

function MetaItem({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  )
}

function formatMilliseconds(value: number | null) {
  if (value === null) return '—'
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(1)}s`
}