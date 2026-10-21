'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { GraduationCap, RefreshCw, Timer, TriangleAlert } from 'lucide-react'
import { Button, CoCharacter, EmptyState, ProgressBar, SpeechBubble } from '@/components/design-system'
import { ActionControl, LearnFrame, MeasuredTag, StepDots } from '@/components/learn/learn-common'
import { dateLabel, minutesLabel } from '@/components/learn/learn-format'
import { bandFromApi, linkHref, type Actionable, type LearnBand } from '@/lib/api/learn'
import { isPracticeId, type HubSet, type PracticeHub, type SessionRow } from '@/lib/api/practice'
import { cn } from '@/lib/utils'
import { reviewEstimate, setSubjects } from './hub-model'
import { SessionHistoryView, SessionList } from './session-row'
import { ModeTag, PracticeReadAloud, StarRow } from './states-parts'

export type HubTab = 'today' | 'past'
export interface HubHistory {
  rows: readonly SessionRow[]
  loading: boolean; error: Error | null
  hasMore: boolean; loadingMore: boolean
  onMore: () => void; onRetry: () => void
}

/**
 * On the hub itself a DUE link with no id must START the review. Everywhere else (home, a lesson) `linkHref` sends the
 * same link to this hub, as the contract says, so the hub gives its own start button the start route.
 */
export function hubStartHref(action: Actionable): string | null {
  const link = action.link
  if (action.enabled && link?.route === 'PRACTICE' && link.scope === 'DUE' && link.id === null) return '/learn/practice/start?scope=DUE'
  return action.enabled ? linkHref(link) : null
}

const startHref = (setId: string) => isPracticeId(setId) ? `/learn/practice/start?scope=SET&id=${encodeURIComponent(setId)}` : null

/* ---------- cards ---------- */

function SetStatusNote({ set, band }: { set: HubSet; band: LearnBand }) {
  const href = startHref(set.id)
  if (set.status === 'READY') return null
  const failed = set.status === 'FAILED'
  return <div data-set-status={set.status} className="space-y-2">
    <p role="status" className="font-semibold text-muted-foreground">{failed ? 'Co could not make these questions.' : band === 'kids' ? 'Co is getting these ready…' : 'Co is getting these questions ready…'}</p>
    {href && <Link href={href} className="ds-button ds-button-secondary">{failed ? 'See what happened' : 'Check on it'}</Link>}
  </div>
}

function SetCard({ set, band }: { set: HubSet; band: LearnBand }) {
  const kids = band === 'kids'
  const last = band !== 'kids' ? dateLabel(set.lastPracticedAt) : null
  const body = <>
    <ModeTag mode="PRACTICE" band={band} showRule={!kids} />
    <h3 className={cn('break-words font-bold', kids && 'text-[length:var(--ds-h2)] font-extrabold')}>{set.title}</h3>
    <p className="text-muted-foreground">{[set.subject?.name, `${set.questionCount} ${set.questionCount === 1 ? 'question' : 'questions'}`].filter(Boolean).join(' · ')}</p>
    {set.status === 'READY' && (set.bestStars !== null || kids) && <p className="flex items-center gap-2 text-[length:var(--ds-small)]"><StarRow stars={set.bestStars} size={kids ? 34 : 20} />{!kids && <span>Best result</span>}</p>}
    {last && <p className="text-[length:var(--ds-small)] text-muted-foreground">Last practised {last}</p>}
    <SetStatusNote set={set} band={band} />
    {set.status === 'READY' && <ActionControl action={set.start} label={kids ? 'Play!' : 'Practise'} block={kids} className={cn(kids && 'text-[length:var(--ds-h3)]')} />}
  </>
  return <li data-testid="practice-set" data-set={set.id} className={cn('ds-card flex flex-col gap-3', kids && 'gap-4 p-6')}>{body}</li>
}

function TeacherCard({ item, band }: { item: PracticeHub['teacherPractice'][number]; band: LearnBand }) {
  const kids = band === 'kids'
  return <li data-testid="teacher-practice" className={cn('ds-card flex flex-col gap-3', kids && 'gap-4 p-6')}>
    <ModeTag mode="PRACTICE" band={band} showRule={false} />
    <h3 className={cn('break-words font-bold', kids && 'text-[length:var(--ds-h2)] font-extrabold')}>{item.title}</h3>
    <p className="inline-flex items-center gap-2 text-muted-foreground"><GraduationCap size={18} aria-hidden="true" />{item.assignedBy ? `From ${item.assignedBy}` : 'From your teacher'}</p>
    {item.questionCount > 0 && (kids ? <StepDots progress={{ done: Math.min(item.practiced, item.questionCount), total: item.questionCount }} label="questions" /> : <ProgressBar label="Questions practised" value={Math.min(item.practiced, item.questionCount)} max={item.questionCount} />)}
    <ActionControl action={item.start} label={kids ? 'Play!' : item.practiced > 0 ? 'Practise again' : 'Practise'} block={kids} className={cn(kids && 'text-[length:var(--ds-h3)]')} />
  </li>
}

/** The timed mock test is built to look and read differently from practice: dashed border, a timer icon and its own rule text. */
function ExamCard({ exam, band }: { exam: PracticeHub['exams'][number]; band: LearnBand }) {
  const kids = band === 'kids'
  return <li data-testid="exam-card" data-mode="EXAM" className={cn('flex flex-col gap-3 rounded-[var(--radius)] border-2 border-dashed border-destructive bg-card p-5', kids && 'gap-4 p-6')}>
    <ModeTag mode="EXAM" band={band} />
    <h3 className={cn('flex items-center gap-2 break-words font-bold', kids && 'text-[length:var(--ds-h2)] font-extrabold')}><Timer size={kids ? 32 : 22} aria-hidden="true" className="shrink-0 text-destructive" />{exam.title}</h3>
    <p className="text-muted-foreground">{exam.questionCount} {exam.questionCount === 1 ? 'question' : 'questions'} · {minutesLabel(exam.minutes) ?? `${exam.minutes} minutes`}</p>
    <ActionControl action={exam.start} label={kids ? 'Start the big test' : 'Start mock test'} variant="secondary" block={kids} className={cn(kids && 'text-[length:var(--ds-h3)]')} />
  </li>
}

function DueCard({ due, band }: { due: NonNullable<PracticeHub['due']>; band: LearnBand }) {
  const kids = band === 'kids'
  const minutes = minutesLabel(due.estimatedMinutes)
  return <section aria-labelledby="due-title" data-testid="due-card" className={cn('ds-card flex flex-wrap items-center gap-5 border-2 border-primary', kids && 'p-7')}>
    <RefreshCw size={kids ? 52 : 36} aria-hidden="true" className="shrink-0 text-primary" />
    <div className="min-w-0 flex-1 basis-60 space-y-2">
      <ModeTag mode="REVIEW" band={band} showRule={!kids} />
      <h2 id="due-title" className={cn('break-words font-extrabold', kids && 'text-[length:var(--ds-h1)]')}>{kids ? 'Remember what you learned' : band === 'tweens' ? 'Today’s review' : 'Reviews due'}</h2>
      <p className="text-muted-foreground" data-testid="due-estimate">{kids ? (minutes ? `About ${minutes}` : 'A few quick cards') : reviewEstimate(due.count, due.estimatedMinutes)}</p>
    </div>
    <ActionControl action={due.start} href={hubStartHref(due.start)} label={kids ? 'Play!' : 'Start review'} block={kids} className={cn(kids && 'min-h-16 text-[length:var(--ds-h3)]')} />
  </section>
}

function WeakSpots({ spots }: { spots: PracticeHub['weakSpots'] }) {
  return <section aria-labelledby="weak-title" data-testid="weak-spots" className="ds-card space-y-3">
    <div className="flex flex-wrap items-center gap-3"><h2 id="weak-title">Weak spots</h2><MeasuredTag>Measured from your practice</MeasuredTag></div>
    {spots.length === 0
      ? <p className="text-muted-foreground">Weak spots will show here once Co can measure them from your practice.</p>
      : <ul className="flex flex-wrap gap-2">{spots.map(spot => <li key={spot.conceptId} className="ds-pill border border-border">{spot.name}</li>)}</ul>}
  </section>
}

function SubjectFilter({ subjects, value, onChange }: { subjects: { id: string; name: string }[]; value: string | null; onChange: (id: string | null) => void }) {
  if (subjects.length < 2) return null
  return <div role="group" aria-label="Show practice for" className="flex flex-wrap gap-2">
    {[{ id: null, name: 'All subjects' }, ...subjects].map(subject => <Button key={subject.id ?? 'all'} variant={value === subject.id ? 'primary' : 'secondary'} aria-pressed={value === subject.id} onClick={() => onChange(subject.id)}>{subject.name}</Button>)}
  </div>
}

function CaughtUp({ band }: { band: LearnBand }) {
  const kids = band === 'kids'
  return <section data-state="caught-up" aria-labelledby="caught-up-title" className="ds-card flex flex-wrap items-center gap-6 border-2 border-primary">
    <CoCharacter band={band} state="celebrating" decorative className={kids ? 'size-32 sm:size-44' : undefined} />
    <div className="min-w-0 flex-1 basis-60 space-y-3">
      <h2 id="caught-up-title" className={cn('font-extrabold', kids && 'text-[length:var(--ds-h1)]')}>All caught up!</h2>
      <p>{kids ? 'Nothing to remember right now.' : 'Nothing is due for review right now.'}</p>
      <Link href={kids ? '/learn/snap' : '/learn/import'} className="ds-button ds-button-secondary">Learn something new</Link>
    </div>
  </section>
}

const kindName = { CODE: 'Code questions', VOICE: 'Spoken answers' } as const
function UnavailableKinds({ items }: { items: PracticeHub['unavailableKinds'] }) {
  if (items.length === 0) return null
  return <section aria-label="Not available yet" data-testid="unavailable-kinds" className="space-y-2 rounded-[var(--radius)] border border-dashed border-border p-4 text-[length:var(--ds-small)] text-muted-foreground">
    <p className="font-bold text-foreground">Not available yet</p>
    <ul className="space-y-1">{items.map(item => <li key={item.kind} className="flex items-start gap-2"><TriangleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" /><span><span className="font-semibold">{kindName[item.kind]}.</span> {item.reason}</span></li>)}</ul>
  </section>
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section aria-labelledby={id} className="space-y-3"><h2 id={id}>{title}</h2>{children}</section>
}

/* ---------- today, by band ---------- */

interface TodayProps { hub: PracticeHub; band: LearnBand; subjectId: string | null; onSubject: (id: string | null) => void; onTab: (tab: HubTab) => void }

function useVisibleSets(hub: PracticeHub, subjectId: string | null) {
  return useMemo(() => subjectId ? hub.sets.filter(set => set.subject?.id === subjectId) : hub.sets, [hub.sets, subjectId])
}

function Recent({ rows, band, onTab }: { rows: readonly SessionRow[]; band: LearnBand; onTab: (tab: HubTab) => void }) {
  if (rows.length === 0 || band === 'kids') return null
  return <Section id="recent-title" title="Recent sessions">
    {band === 'tweens' ? <SessionList rows={rows.slice(0, 3)} band={band} /> : <SessionHistoryView rows={rows.slice(0, 3)} band={band} />}
    <Button variant="ghost" onClick={() => onTab('past')}>See all past sessions</Button>
  </Section>
}

function KidsToday({ hub, band, subjectId }: TodayProps) {
  const sets = useVisibleSets(hub, subjectId)
  const tiles = hub.sets.length + hub.teacherPractice.length + hub.exams.length + (hub.due ? 1 : 0)
  return <>
    <div className="flex flex-wrap items-center gap-6">
      <CoCharacter band={band} state="waving" decorative className="size-28 sm:size-44" />
      <SpeechBubble className="min-w-[14rem] max-w-xl flex-1">{tiles > 0 ? 'Pick a game to play!' : 'Let’s learn something first!'}</SpeechBubble>
    </div>
    {hub.due && <DueCard due={hub.due} band={band} />}
    {(sets.length > 0 || hub.teacherPractice.length > 0) && <ul aria-label="Games" data-testid="games" className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">
      {sets.map(set => <SetCard key={set.id} set={set} band={band} />)}
      {hub.teacherPractice.map(item => <TeacherCard key={`${item.planId}:${item.topicId ?? ''}`} item={item} band={band} />)}
    </ul>}
    {hub.exams.length > 0 && <Section id="exam-title" title="Big test"><ul className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">{hub.exams.map(exam => <ExamCard key={exam.planId} exam={exam} band={band} />)}</ul></Section>}
  </>
}

function TweensToday({ hub, band, subjectId, onSubject, onTab }: TodayProps) {
  const sets = useVisibleSets(hub, subjectId)
  return <>
    <div className="flex flex-wrap items-center gap-5">
      <CoCharacter band={band} state="idle" decorative />
      <SpeechBubble className="min-w-[14rem] max-w-xl flex-1">{hub.due ? 'Let’s warm up with a quick review.' : 'Pick something to practise.'}</SpeechBubble>
    </div>
    {hub.due && <DueCard due={hub.due} band={band} />}
    <SubjectFilter subjects={setSubjects(hub.sets)} value={subjectId} onChange={onSubject} />
    {sets.length > 0 && <Section id="subjects-title" title="Practice by subject"><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sets.map(set => <SetCard key={set.id} set={set} band={band} />)}</ul></Section>}
    {hub.teacherPractice.length > 0 && <Section id="teacher-title" title="From your teacher"><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{hub.teacherPractice.map(item => <TeacherCard key={`${item.planId}:${item.topicId ?? ''}`} item={item} band={band} />)}</ul></Section>}
    {hub.exams.length > 0 && <Section id="exam-title" title="Mock tests"><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{hub.exams.map(exam => <ExamCard key={exam.planId} exam={exam} band={band} />)}</ul></Section>}
    <Recent rows={hub.recent} band={band} onTab={onTab} />
  </>
}

function TeensToday({ hub, band, subjectId, onSubject, onTab }: TodayProps) {
  const sets = useVisibleSets(hub, subjectId)
  return <>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {hub.due ? <DueCard due={hub.due} band={band} /> : <div />}
      <WeakSpots spots={hub.weakSpots} />
    </div>
    {hub.exams.length > 0 && <Section id="exam-title" title="Mock tests"><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{hub.exams.map(exam => <ExamCard key={exam.planId} exam={exam} band={band} />)}</ul></Section>}
    <SubjectFilter subjects={setSubjects(hub.sets)} value={subjectId} onChange={onSubject} />
    {sets.length > 0 && <Section id="subjects-title" title="Practice by material"><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{sets.map(set => <SetCard key={set.id} set={set} band={band} />)}</ul></Section>}
    {hub.teacherPractice.length > 0 && <Section id="teacher-title" title="Set by your teacher"><ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{hub.teacherPractice.map(item => <TeacherCard key={`${item.planId}:${item.topicId ?? ''}`} item={item} band={band} />)}</ul></Section>}
    <Recent rows={hub.recent} band={band} onTab={onTab} />
  </>
}

/* ---------- past sessions ---------- */

function PastSessions({ history, band }: { history: HubHistory; band: LearnBand }) {
  if (history.loading && history.rows.length === 0) return <div role="status" data-state="loading" aria-label="Loading past sessions" className="space-y-3"><span className="sr-only">Loading past sessions</span>{[0, 1, 2].map(index => <div key={index} aria-hidden="true" className="ds-skeleton h-20 w-full" />)}</div>
  if (history.error && history.rows.length === 0) return <div role="alert" data-state="history-error" className="ds-card space-y-3"><p>{history.error.message}</p><Button onClick={history.onRetry}>Try again</Button></div>
  if (history.rows.length === 0) return <div data-state="no-history"><EmptyState band={band} title={band === 'kids' ? 'No rounds yet' : 'No past sessions yet'} description={band === 'kids' ? 'Play a game and it will show up here.' : 'When you finish a practice, it shows up here.'} /></div>
  return <div data-state="past" className="space-y-4">
    <SessionHistoryView rows={history.rows} band={band} />
    {history.error && <p role="alert" className="ds-field-error">{history.error.message}</p>}
    {history.hasMore && <Button variant="secondary" onClick={history.onMore} loading={history.loadingMore}>Show more</Button>}
  </div>
}

/* ---------- the hub ---------- */

/** Pure presentation of one /learn/practice/hub response. No fetching and no canned data. */
export function HubView({ hub, tab, onTab, subjectId, onSubject, history }: { hub: PracticeHub; tab: HubTab; onTab: (tab: HubTab) => void; subjectId: string | null; onSubject: (id: string | null) => void; history: HubHistory }) {
  const band = bandFromApi(hub.band)
  const kids = band === 'kids'
  const title = kids ? 'Play' : 'Practice'
  const Today = band === 'kids' ? KidsToday : band === 'tweens' ? TweensToday : TeensToday
  const empty = hub.state === 'NO_CONTENT'
  return <LearnFrame band={band} label={title}>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[length:var(--ds-h1)]">{title}</h1>
        {kids && <PracticeReadAloud text="Play. Pick a game to play." />}
      </div>
      <div role="group" aria-label="Practice views" className="flex gap-1 rounded-full bg-muted p-1">
        {([['today', kids ? 'Games' : 'Today'], ['past', kids ? 'My rounds' : 'Past sessions']] as const).map(([value, label]) =>
          <Button key={value} variant={tab === value ? 'primary' : 'ghost'} aria-pressed={tab === value} onClick={() => onTab(value)} className="rounded-full">{label}</Button>)}
      </div>
    </div>
    {tab === 'past' ? <PastSessions history={history} band={band} /> : empty ? <NoContent band={band} /> : <>
      {hub.state === 'CAUGHT_UP' && <CaughtUp band={band} />}
      <Today hub={hub} band={band} subjectId={subjectId} onSubject={onSubject} onTab={onTab} />
      <UnavailableKinds items={hub.unavailableKinds} />
    </>}
    {tab === 'today' && empty && <UnavailableKinds items={hub.unavailableKinds} />}
  </LearnFrame>
}

function NoContent({ band }: { band: LearnBand }) {
  const kids = band === 'kids'
  return <div data-state="no-content"><EmptyState band={band} title={kids ? 'Nothing to play yet' : 'Nothing to practise yet'}
    description={kids ? 'Snap a page from your book and Co will make a game from it.' : 'Practice is made from your own material and from what your teacher sets. Bring something to learn and ask Co for questions.'}
    action={<div className="flex flex-wrap justify-center gap-3">
      <Link href={kids ? '/learn/snap' : '/learn/import'} className="ds-button ds-button-primary">{kids ? 'Snap a page from your book!' : 'Bring something to learn'}</Link>
      <Link href="/learn/library" className="ds-button ds-button-secondary">{kids ? 'My pages' : 'Open my library'}</Link>
    </div>} /></div>
}

