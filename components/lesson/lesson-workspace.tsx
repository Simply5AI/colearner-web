'use client'

import { useId, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { Button, CoCharacter } from '@/components/design-system'
import { LearnFrame, useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { lessonApi, lessonBand, lessonErrorMessage, type LessonSummary } from '@/lib/api/lesson'
import { lessonKeys, useLessonDetail, useLessonMaterial, useTopicLessons } from './lesson-hooks'
import { LessonScreen } from './lesson-screen'
import { panelDomId, tabDomId, TopicTabs, type LessonTabsSlot, type TopicTab } from './lesson-tabs'

export const OVERVIEW = 'overview'

export interface Topic { key: string; label: string; conceptId: string | null; summary: string | null }

/** Overview first, then the material's key ideas in order. The one-line "what you'll learn" comes from the analysis. */
export function topicsOf(concepts: readonly { id: string; label: string }[], analysis: unknown): Topic[] {
  const described = new Map<string, string>()
  const list = (analysis as { concepts?: unknown } | null)?.concepts
  if (Array.isArray(list)) for (const item of list) {
    const { name, description } = (item ?? {}) as { name?: unknown; description?: unknown }
    if (typeof name === 'string' && typeof description === 'string') described.set(name.trim().toLowerCase(), description.trim())
  }
  const oneLine = (text: string | undefined) => text ? (text.split(/(?<=[.!?])\s/)[0] ?? text).slice(0, 200) : null
  return [
    { key: OVERVIEW, label: 'Overview', conceptId: null, summary: 'A quick look at every key idea, with the basics and one simple example each.' },
    ...concepts.map(concept => ({ key: concept.id, label: concept.label, conceptId: concept.id, summary: oneLine(described.get(concept.label.trim().toLowerCase())) })),
  ]
}

/** The newest lesson of a topic, from the material's lesson list. */
export const lessonOfTopic = (lessons: readonly LessonSummary[], topic: Topic) => lessons.find(item => (item.conceptId ?? null) === topic.conceptId) ?? null
const tabState = (lesson: LessonSummary | null): TopicTab['state'] => !lesson || lesson.status === 'CANCELLED' ? 'none' : lesson.status === 'READY' ? 'ready' : lesson.status === 'FAILED' ? 'none' : 'making'

/** A topic nobody has asked for yet: nothing is made until the learner presses the button. */
function TopicStart({ band, topic, bar, panel, onStart, pending, error }: { band: LearnBand; topic: Topic; bar: ReactNodeLike; panel: Pick<LessonTabsSlot, 'panelId' | 'tabId'>; onStart: () => void; pending: boolean; error: Error | null }) {
  const overview = topic.conceptId === null
  return <LearnFrame band={band} label={`${topic.label}: not made yet`}>
    {bar}
    <section role="tabpanel" id={panel.panelId} aria-labelledby={panel.tabId} data-state="topic-not-made" className="ds-card flex flex-wrap items-center gap-5 p-6">
      <CoCharacter band={band} state="curious" decorative />
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <h1 className="text-[length:var(--ds-h2)]">{topic.label}</h1>
        {topic.summary && <p className="text-muted-foreground"><span className="font-bold">What you&apos;ll learn: </span>{topic.summary}</p>}
        {error && <p role="alert" className="ds-field-error">{lessonErrorMessage(error)}</p>}
        <Button onClick={onStart} loading={pending}><Sparkles size={16} aria-hidden="true" />{overview ? 'Make the overview' : 'Learn this in detail'}</Button>
      </div>
    </section>
  </LearnFrame>
}
type ReactNodeLike = React.ReactNode

/**
 * The lesson page (pack 0.1.11): tabs per topic. The overview is the lesson made when a material is first opened; each
 * key idea has its own deep lesson that is made only when the learner asks. Lessons are cached per (material, concept),
 * so a made tab reopens at once, and each lesson keeps its own place. The selected tab is `?topic=` (an id or `overview`).
 */
export function LessonWorkspace({ lessonId }: { lessonId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const scope = useId().replace(/[^a-zA-Z0-9]/g, '')
  const client = useQueryClient()
  const { actor, band: identityBand } = useLearnIdentity()
  const entry = useLessonDetail(lessonId)
  const materialId = entry.data?.lesson.materialId ?? ''
  const material = useLessonMaterial(materialId, !!materialId)
  const lessons = useTopicLessons(materialId, !!materialId)
  const topics = useMemo(() => material.data ? topicsOf(material.data.concepts, material.data.analysis) : [], [material.data])
  const create = useMutation({
    mutationFn: (topic: Topic) => lessonApi.create({ materialId, ...(topic.conceptId ? { conceptId: topic.conceptId } : {}) }), retry: false,
    onSuccess: async () => { await client.invalidateQueries({ queryKey: lessonKeys.topics(actor, materialId) }) },
  })
  const refreshList = () => void client.invalidateQueries({ queryKey: lessonKeys.topics(actor, materialId) })

  // No key ideas (or the extras are still loading or unavailable): the lesson alone, exactly as before.
  if (!entry.data || !material.data || !lessons.data || topics.length < 2) return <LessonScreen lessonId={lessonId} onLessonChanged={materialId ? refreshLessonRedirect(router, refreshList) : undefined} />

  const band: LearnBand = identityBand ?? lessonBand(entry.data.lesson.band)
  const wanted = params.get('topic') ?? entry.data.lesson.conceptId ?? OVERVIEW
  const selected = topics.find(topic => topic.key === wanted) ?? topics[0]!
  const select = (key: string) => router.replace(`${pathname}?topic=${encodeURIComponent(key)}`, { scroll: false })
  const tabs: TopicTab[] = topics.map(topic => ({ key: topic.key, label: topic.label, state: tabState(lessonOfTopic(lessons.data.lessons, topic)) }))
  const slot: LessonTabsSlot = {
    bar: <TopicTabs scope={scope} tabs={tabs} selected={selected.key} onSelect={select} />,
    panelId: panelDomId(scope), tabId: tabDomId(scope, selected.key),
  }
  const lesson = lessonOfTopic(lessons.data.lessons, selected)
  if (!lesson || lesson.status === 'CANCELLED') return <TopicStart band={band} topic={selected} bar={slot.bar} panel={slot} onStart={() => create.mutate(selected)} pending={create.isPending} error={create.error} />
  return <LessonScreen key={lesson.id} lessonId={lesson.id} tabs={slot} onLessonChanged={() => refreshList()} />
}

/** A retry made a newer version of the entry lesson: the list is refreshed and the page moves to the new id. */
const refreshLessonRedirect = (router: ReturnType<typeof useRouter>, refresh: () => void) => (id: string) => { refresh(); router.replace(`/learn/lesson/${encodeURIComponent(id)}`) }
