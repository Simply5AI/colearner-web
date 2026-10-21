'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, ChevronDown, ClipboardCheck, ExternalLink, FileText, ListChecks, PenLine, Star } from 'lucide-react'
import { Card, CoCharacter, EmptyState, ProgressBar } from '@/components/design-system'
import { bandFromApi, linkHref, safeExternalUrl, type LearnBand, type PlanDetail, type PlanItem, type PlanTopic } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { ActionControl, CoSuggestionTag, LearnFrame, LearnLoadError, LearnSkeleton, LockedTag, MeasuredTag, StepDots, useLearnIdentity, useLearnPlan } from './learn-common'
import { dateLabel, dueLabel, itemStatusLabel, originLabel, sourceLabel } from './learn-format'

const itemIcon = { LESSON: BookOpen, PRACTICE: PenLine, QUIZ: ListChecks, MOCK_TEST: ClipboardCheck } as const
const itemAction = { LESSON: 'Start lesson', PRACTICE: 'Practise', QUIZ: 'Take quiz', MOCK_TEST: 'Take a mock test' } as const
const itemWord = { LESSON: 'Lesson', PRACTICE: 'Practice', QUIZ: 'Quiz', MOCK_TEST: 'Mock test' } as const
const topicWord = { NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', DONE: 'Done' } as const

function ItemRow({ item, current, band }: { item: PlanItem; current: boolean; band: LearnBand }) {
  const Icon = itemIcon[item.kind]
  return <li className={cn('flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-border p-3', current && 'border-2 border-primary')} data-testid="plan-item" data-current={current || undefined}>
    <Icon size={band === 'kids' ? 28 : 20} aria-hidden="true" className="text-primary" />
    <div className="min-w-0 flex-1"><p className="break-words font-bold">{item.title}</p><p className="text-[length:var(--ds-small)] text-muted-foreground">{itemWord[item.kind]} · {itemStatusLabel[item.status]}{current ? ' · Up next' : ''}</p></div>
    {item.status !== 'DONE' && item.status !== 'SKIPPED' && <ActionControl action={item} label={itemAction[item.kind]} variant={current ? 'primary' : 'secondary'} />}
  </li>
}

function TopicPanel({ topic, nextItemId, band, canAttach, id }: { topic: PlanTopic; nextItemId: string | null; band: LearnBand; canAttach: boolean; id?: string }) {
  const due = dueLabel(topic.dueAt, band)
  return <div id={id} className="space-y-3" data-testid="topic-panel">
    {due && <p className={cn('text-[length:var(--ds-small)]', due.overdue && band !== 'kids' && 'font-bold text-destructive')}>{due.text}</p>}
    {topic.items.length > 0 ? <ul className="space-y-2">{topic.items.map(item => <ItemRow key={item.id} item={item} current={item.id === nextItemId} band={band} />)}</ul> : <p className="text-muted-foreground">No lessons or practice have been added to this topic yet.</p>}
    {topic.materials.length > 0
      ? <div><h4 className="mb-2 font-bold">Sources for this topic</h4><ul className="flex flex-wrap gap-2">{topic.materials.map(material => {
        const href = linkHref({ route: 'LIBRARY_ITEM', id: material.id })
        return <li key={material.id} className="ds-pill">{href ? <Link href={href} className="hover:underline">{material.title}</Link> : material.title}<span className="font-normal text-muted-foreground"> · {originLabel[material.origin]}</span></li>
      })}</ul></div>
      : canAttach ? <div data-state="no-sources" className="rounded-[var(--radius)] border border-dashed border-border p-3"><p className="font-bold">Bring material for this topic</p><p className="mb-2 text-[length:var(--ds-small)] text-muted-foreground">Add a page, file or some text and it will be kept with your plan.</p><Link href="/learn/import" className="ds-button ds-button-secondary">Import a source</Link></div>
        : <p className="text-[length:var(--ds-small)] text-muted-foreground">No sources have been added to this topic.</p>}
  </div>
}

/* ---------- kids: adventure-map path (F-L3-02) ---------- */

type Flat = { topic: PlanTopic; phase: string }
const offsets = [0, 52, 104, 52]
function AdventureMap({ detail, stones, currentId, initialOpen }: { detail: PlanDetail; stones: Flat[]; currentId: string | null; initialOpen: string | null }) {
  const [openId, setOpenId] = useState<string | null>(initialOpen)
  const panelId = useId()
  const open = stones.find(stone => stone.topic.id === openId)?.topic
  const current = stones.find(stone => stone.topic.id === currentId)?.topic
  return <section aria-labelledby="adventure-map" className="space-y-5" data-testid="adventure-map">
    <div className="flex flex-wrap items-center gap-3"><h2 id="adventure-map">Your adventure map</h2>{current && <p className="ds-pill" data-testid="next-stone">Next: {current.title}!</p>}</div>
    <ol className="space-y-3">{stones.map(({ topic }, index) => {
      const done = topic.status === 'DONE'
      const here = topic.id === currentId
      return <li key={topic.id} className="flex items-center gap-3" style={{ marginInlineStart: offsets[index % offsets.length] }}>
        <button type="button" aria-expanded={openId === topic.id} aria-controls={panelId} onClick={() => setOpenId(openId === topic.id ? null : topic.id)}
          aria-label={`${topic.title}, ${done ? 'done' : here ? 'next up' : topicWord[topic.status].toLowerCase()}`} data-stone={done ? 'done' : here ? 'current' : 'todo'}
          className={cn('flex size-[72px] shrink-0 items-center justify-center rounded-full border-4 text-[length:var(--ds-h3)] font-extrabold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring', done ? 'border-primary bg-primary text-primary-foreground' : here ? 'border-primary bg-secondary shadow-[0_0_0_8px_rgb(232_129_62/30%)]' : 'border-border bg-card')}>
          {done ? <Star aria-hidden="true" size={32} /> : index + 1}
        </button>
        <span className="min-w-0 break-words text-[length:var(--ds-h3)] font-bold">{topic.title}</span>
        {here && <CoCharacter band="kids" state="idle" size={96} decorative />}
      </li>
    })}</ol>
    <div id={panelId} aria-live="polite">{open && <Card className="space-y-3"><h3>{open.title}</h3><TopicPanel topic={open} nextItemId={detail.nextItemId} band="kids" canAttach={detail.permissions.canAttachMaterial} /></Card>}</div>
  </section>
}

/* ---------- tweens: levels; teens: chapters ---------- */

function TopicCard({ topic, nextItemId, band, canAttach, expanded, onToggle }: { topic: PlanTopic; nextItemId: string | null; band: LearnBand; canAttach: boolean; expanded: boolean; onToggle: () => void }) {
  const panelId = useId()
  return <li className="ds-card space-y-3" data-testid="topic">
    <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle} className="flex w-full min-w-0 items-center gap-3 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <span className="min-w-0 flex-1"><span className="block break-words font-extrabold">{topic.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-[length:var(--ds-small)]"><span className="ds-pill" data-status={topic.status}>{topicWord[topic.status]}</span>
          {topic.masteryPercent !== null && <span className="ds-pill" data-testid="topic-mastery">Mastery {Math.round(topic.masteryPercent)}%<MeasuredTag>Measured</MeasuredTag></span>}</span></span>
      <ChevronDown aria-hidden="true" className={cn('size-5 shrink-0 motion-safe:transition-transform', expanded && 'rotate-180')} />
    </button>
    {expanded && <TopicPanel id={panelId} topic={topic} nextItemId={nextItemId} band={band} canAttach={canAttach} />}
  </li>
}

function PhaseList({ detail, band, initialOpen }: { detail: PlanDetail; band: LearnBand; initialOpen: string | null }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(initialOpen ? [initialOpen] : []))
  const toggle = (id: string) => setOpen(current => { const next = new Set(current); if (!next.delete(id)) next.add(id); return next })
  const levels = band === 'tweens'
  return <section aria-labelledby="plan-path" className="space-y-5">
    <h2 id="plan-path">{levels ? 'Levels' : 'Chapters'}</h2>
    {detail.phases.length === 0 && <p className="text-muted-foreground">No steps have been added to this plan yet.</p>}
    {[...detail.phases].sort((a, b) => a.ordinal - b.ordinal).map((phase, index) => <div key={phase.id} className="space-y-3" data-testid="phase">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="break-words">{levels ? `Level ${index + 1}: ` : ''}{phase.title}</h3>{phase.progress.total > 0 && <div className="w-48 max-w-full"><ProgressBar label="Done" value={phase.progress.done} max={phase.progress.total} /></div>}</div>
      <ul className="space-y-3">{phase.topics.map(topic => <TopicCard key={topic.id} topic={topic} nextItemId={detail.nextItemId} band={band} canAttach={detail.permissions.canAttachMaterial} expanded={levels || open.has(topic.id)} onToggle={() => toggle(topic.id)} />)}</ul>
    </div>)}
  </section>
}

/* ---------- sources, suggestions, weak concepts ---------- */

function Sources({ detail, band }: { detail: PlanDetail; band: LearnBand }) {
  const { materials, permissions } = detail
  return <section aria-labelledby="sources" className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="sources">{band === 'kids' ? 'My pages' : 'Sources'}</h2>{permissions.canAttachMaterial && <Link href="/learn/import" className="ds-button ds-button-secondary">Import a source</Link>}</div>
    {materials.length === 0
      ? <div data-state="no-sources"><EmptyState band={band} title="No sources yet" description={permissions.canAttachMaterial ? 'Bring material for this plan and Co will help you use it.' : 'No sources have been added to this plan yet.'} action={permissions.canAttachMaterial ? <Link href="/learn/import" className="ds-button ds-button-primary">Bring material</Link> : undefined} /></div>
      : <ul className="grid gap-3 sm:grid-cols-2">{materials.map(material => {
        const href = linkHref(material.link)
        return <li key={material.id} className="ds-card flex items-start gap-3" data-testid="plan-material"><FileText aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" /><div className="min-w-0">{href ? <Link href={href} className="break-words font-bold hover:underline">{material.title}</Link> : <p className="break-words font-bold">{material.title}</p>}<p className="text-[length:var(--ds-small)] text-muted-foreground">{sourceLabel(material.sourceType)} · {originLabel[material.origin]}</p></div></li>
      })}</ul>}
  </section>
}

function Suggestions({ state }: { state: PlanDetail['suggestedResources'] }) {
  if (state.status !== 'AVAILABLE' || state.items.length === 0) return null
  return <section aria-labelledby="suggested" data-testid="suggested-resources" className="ds-card space-y-3 border-dashed">
    <div className="flex flex-wrap items-center gap-3"><h2 id="suggested">Suggested resources</h2><CoSuggestionTag /></div>
    <p className="text-[length:var(--ds-caption)] text-muted-foreground">Co suggests these. They are not part of your plan until you add them, so check with a grown-up before using a website.</p>
    <ul className="space-y-3">{state.items.map((item, index) => {
      const url = safeExternalUrl(item.url)
      return <li key={`${index}:${item.title}`}>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-words font-bold hover:underline">{item.title}<ExternalLink size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a> : <p className="break-words font-bold">{item.title}</p>}<p className="text-[length:var(--ds-small)] text-muted-foreground">{item.reason}</p></li>
    })}</ul>
  </section>
}

function WeakConcepts({ concepts }: { concepts: PlanDetail['weakConcepts'] }) {
  if (concepts.length === 0) return null
  return <section aria-labelledby="weak" data-testid="weak-concepts" className="space-y-3">
    <div className="flex flex-wrap items-center gap-3"><h2 id="weak">Worth another look</h2><MeasuredTag>Measured from your practice</MeasuredTag></div>
    <ul className="flex flex-wrap gap-2">{concepts.map(concept => <li key={concept.conceptId} className="ds-pill">{concept.name}</li>)}</ul>
  </section>
}

/* ---------- page ---------- */

export interface PlanViewProps { detail: PlanDetail; band: LearnBand; initialExpandedTopicId?: string | null }

/** Pure presentation of /learn/plans/:planId (L3). It has no structure-editing controls for any plan. */
export function PlanDetailView({ detail, band, initialExpandedTopicId = null }: PlanViewProps) {
  const { plan, permissions } = detail
  const kids = band === 'kids'
  const items = useMemo(() => detail.phases.flatMap(phase => phase.topics.flatMap(topic => topic.items)), [detail.phases])
  const nextItem = permissions.canStartNext && detail.nextItemId ? items.find(item => item.id === detail.nextItemId) : undefined
  const mock = band === 'teens' ? items.find(item => item.kind === 'MOCK_TEST' && item.status !== 'DONE') : undefined
  const stones: Flat[] = [...detail.phases].sort((a, b) => a.ordinal - b.ordinal).flatMap(phase => phase.topics.map(topic => ({ topic, phase: phase.title })))
  const currentStone = detail.nextItemId ? stones.find(stone => stone.topic.items.some(item => item.id === detail.nextItemId)) : undefined
  const currentId = (currentStone ?? stones.find(stone => stone.topic.status !== 'DONE'))?.topic.id ?? null
  const due = dueLabel(plan.dueAt, band)
  const exam = dateLabel(plan.examDate)
  const note = plan.teacherNote?.trim()
  const lockedText = plan.locked || !permissions.canEditStructure ? (permissions.lockedReason ?? (plan.kind === 'ASSIGNED' ? 'Your teacher controls the steps of this plan.' : null)) : null
  return <LearnFrame band={band} label={plan.title}>
    <Link href="/learn" className="ds-button ds-button-ghost -ms-3 w-fit"><ArrowLeft aria-hidden="true" size={18} className="rtl:rotate-180" />{kids ? 'All adventures' : 'Back to Learn'}</Link>
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="ds-pill" data-kind="plan-source">{plan.kind === 'ASSIGNED' ? [plan.assignedBy ? `From ${plan.assignedBy.name}` : 'From your teacher', plan.className].filter(Boolean).join(' · ') : 'My plan'}</span>
        {plan.locked && <LockedTag>Set by your teacher</LockedTag>}
        {plan.status === 'COMPLETED' && <span className="ds-pill">Completed</span>}
      </div>
      <h1 className="break-words">{plan.title}</h1>
      <p className="flex flex-wrap gap-x-4 text-muted-foreground">{[plan.subject?.name, plan.mode === 'EXAM_PREP' ? 'Exam prep' : plan.mode === 'SYLLABUS' ? 'Syllabus' : 'Topic'].filter(Boolean).join(' · ')}{due && <span className={cn(due.overdue && !kids && 'font-bold text-destructive')}>{due.text}</span>}{exam && <span>Exam {exam}</span>}</p>
      {kids ? <StepDots progress={plan.progress} label="steps" /> : plan.progress.total > 0 && <div className="max-w-md"><ProgressBar label="Items done" value={plan.progress.done} max={plan.progress.total} /></div>}
    </header>
    {lockedText && <div role="note" data-state="locked" className="ds-card flex items-start gap-3 border-2 border-border"><LockedTag>Locked</LockedTag><p>{lockedText}</p></div>}
    {note && <figure data-testid="teacher-note" className="ds-card space-y-2 border-s-4 border-s-primary"><figcaption className="font-bold">A note from {plan.assignedBy?.name ?? 'your teacher'}</figcaption><blockquote className="whitespace-pre-line break-words">{note}</blockquote></figure>}
    <div className="flex flex-wrap items-start gap-3">
      {nextItem && <div data-testid="start-next"><ActionControl action={nextItem} label={`Start next: ${nextItem.title}`} /></div>}
      {mock && <ActionControl action={mock} label="Take a mock test" variant="secondary" />}
    </div>
    {kids ? <AdventureMap detail={detail} stones={stones} currentId={currentId} initialOpen={initialExpandedTopicId} /> : <PhaseList detail={detail} band={band} initialOpen={initialExpandedTopicId} />}
    {!kids && <WeakConcepts concepts={detail.weakConcepts} />}
    <Sources detail={detail} band={band} />
    <Suggestions state={detail.suggestedResources} />
  </LearnFrame>
}

export function LearnPlanScreen({ planId }: { planId: string }) {
  // Only the loading and error states need a guess; a loaded plan always carries the server-resolved band.
  const { band: hint } = useLearnIdentity()
  const query = useLearnPlan(planId)
  if (query.isPending) return <LearnSkeleton band={hint ?? 'teens'} label="Loading your plan" />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={hint ?? 'teens'} backHref="/learn" backLabel="Back to Learn" />
  return <PlanDetailView detail={query.data} band={bandFromApi(query.data.band)} />
}
