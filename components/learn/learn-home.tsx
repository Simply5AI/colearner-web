'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowUpRight, BookOpen, Camera, CalendarClock, ChartNoAxesColumnIncreasing, FileText, Gamepad2, Library, ListChecks, MessageCircle, Mic, PencilLine, Plus, RefreshCw } from 'lucide-react'
import { Card, CoAvatar, CoCharacter, EmptyState, ProgressBar, RewardBadge, SpeechBubble } from '@/components/design-system'
import { bandFromApi, linkHref, type HomeAssignment, type LearnBand, type LearnHome, type NextAction, type Recommendation, type SubjectProgress, type TodayItem } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { ActionControl, CoSuggestionTag, LearnFrame, LearnLoadError, LearnSkeleton, MeasuredTag, StepDots, TimePill, useLearnHome, useLearnIdentity } from './learn-common'
import styles from './learn-home.module.css'
import { daysLabel, dueLabel, materialStatusText, minutesLabel } from './learn-format'

/* ---------- next action (F-L1-01) ---------- */

const kindLabel: Record<NextAction['kind'], string> = {
  CONTINUE_LESSON: 'Continue', DUE_REVIEW: 'Start review', ASSIGNMENT: 'Open assignment', START_PLAN: 'Start plan', IMPORT_MATERIAL: 'Bring something to learn',
}
const kindEyebrow: Record<NextAction['kind'], string> = {
  CONTINUE_LESSON: 'Pick up where you left off', DUE_REVIEW: 'Time to remember', ASSIGNMENT: 'From your teacher', START_PLAN: 'Start something new', IMPORT_MATERIAL: 'Get started',
}

function greeting(band: LearnBand, name: string, action: NextAction | null): string {
  const hi = band === 'kids' ? `Hi ${name}!` : `Hi ${name}.`
  if (!action) return `${hi} What shall we learn?`
  const text = {
    CONTINUE_LESSON: band === 'kids' ? `Let's finish ${action.title}!` : `Ready to keep going with ${action.title}?`,
    DUE_REVIEW: band === 'kids' ? "Let's remember what we learned!" : 'Some reviews are ready for you.',
    ASSIGNMENT: band === 'kids' ? 'Your teacher has something for you!' : `${action.title} is waiting for you.`,
    START_PLAN: `Ready to start ${action.title}?`,
    IMPORT_MATERIAL: band === 'kids' ? 'Show me what you want to learn!' : 'Bring something to learn and I will help.',
  }[action.kind]
  return `${hi} ${text}`
}

export function NextActionCard({ action, band, limited }: { action: NextAction; band: LearnBand; limited?: boolean }) {
  const kids = band === 'kids'
  const due = dueLabel(action.dueAt, band)
  const minutes = minutesLabel(action.estimatedMinutes)
  const importing = action.kind === 'IMPORT_MATERIAL'
  const label = kids && importing ? 'Snap a page from your book!' : kindLabel[action.kind]
  return <Card aria-labelledby="next-step-title" data-testid="next-action" data-kind={action.kind} className={cn('learn-next-action space-y-4', styles.nextAction, kids && 'p-7')}>
    <div className={styles.nextEyebrow}><span><BookOpen size={16} aria-hidden="true" />{kindEyebrow[action.kind]}</span><span className={styles.nextLabel}>Your next step</span></div>
    {!kids && <CoCharacter band={band} state="idle" size={100} decorative className={styles.nextCo} />}
    <div className={styles.nextTitle}>
      <h2 id="next-step-title" className={cn('break-words font-extrabold', kids && 'text-[length:var(--ds-h1)]')}>{action.title}</h2>
      {action.subtitle && <p className="text-muted-foreground">{action.subtitle}</p>}
    </div>
    {action.progress && action.progress.total > 0 && (kids ? <StepDots progress={action.progress} label="steps" /> : <ProgressBar label="Steps done" value={action.progress.done} max={action.progress.total} />)}
    {(due || minutes) && <p className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--ds-small)] text-muted-foreground">
      {due && <span className={cn('inline-flex items-center gap-1', due.overdue && !kids && 'font-bold text-destructive')}><CalendarClock size={16} aria-hidden="true" />{due.text}</span>}
      {minutes && <span>About {minutes}</span>}
    </p>}
    <ActionControl action={limited && (action.kind === 'CONTINUE_LESSON' || action.kind === 'DUE_REVIEW') ? { ...action, enabled: false, disabledReason: action.disabledReason ?? 'Today’s learning time is used up.' } : action} label={label} className={cn(kids && 'w-full text-[length:var(--ds-h3)]')} block={kids} />
  </Card>
}

/* ---------- first time / limit (F-L1-07) ---------- */

function FirstTime({ band }: { band: LearnBand }) {
  const kids = band === 'kids'
  return <div data-state="first-time"><EmptyState band={band} title="Bring something to learn"
    description={kids ? 'Take a picture of a page from your book and Co will help you learn it.' : 'Add a page, file or some text. Co will help you turn it into things to learn.'}
    action={<div className="flex flex-wrap justify-center gap-3">
      <Link href={kids ? '/learn/snap' : '/learn/import'} className="ds-button ds-button-primary">{kids ? 'Snap a page from your book!' : 'Bring something to learn'}</Link>
      <Link href={kids ? '/learn/import' : '/learn/snap'} className="ds-button ds-button-secondary">{kids ? 'Add a file or words' : 'Snap a page'}</Link>
    </div>} /></div>
}
function LimitBanner({ band }: { band: LearnBand }) {
  return <div role="status" data-state="limit-reached" className="ds-card flex items-center gap-4 border-2 border-primary">
    <CoCharacter band={band} state="sleepy" decorative />
    <div className="min-w-0"><h2>{band === 'kids' ? 'All done for today!' : 'You have reached today’s learning time'}</h2><p className="text-muted-foreground">{band === 'kids' ? 'Co is going to rest. See you tomorrow!' : 'Your school or family sets how long you can learn each day. Co will be ready for you tomorrow.'}</p></div>
  </div>
}

/* ---------- plan, assignments, subjects ---------- */

const itemIcons = { REVIEW: RefreshCw, LESSON: BookOpen, QUIZ: ListChecks } as const
const itemWord = { REVIEW: 'Review', LESSON: 'Lesson', QUIZ: 'Quiz' } as const
function TodayPlan({ plan, band, limited }: { plan: NonNullable<LearnHome['todayPlan']>; band: LearnBand; limited?: boolean }) {
  const minutes = minutesLabel(plan.estimatedMinutes)
  if (plan.items.length === 0) return null
  return <section aria-labelledby="today-plan" className={styles.plan}>
    <h2 id="today-plan">Today&rsquo;s plan{minutes && <span className="text-muted-foreground"> · about {minutes}</span>}</h2>
    <ol className={styles.planList}>{plan.items.map((item: TodayItem, index) => {
      const Icon = itemIcons[item.kind]
      const itemMinutes = minutesLabel(item.estimatedMinutes)
      return <li key={`${item.kind}:${index}`} className={styles.planItem}>
        <span className={styles.iconTile}><Icon size={band === 'kids' ? 32 : 20} strokeWidth={1.8} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1"><p className="break-words font-bold">{item.title}</p><p className="text-[length:var(--ds-small)] text-muted-foreground">{itemWord[item.kind]}{itemMinutes ? ` · ${itemMinutes}` : ''}</p></div>
        <ActionControl action={limited ? { ...item, enabled: false, disabledReason: item.disabledReason ?? 'Today’s learning time is used up.' } : item} label="Start" variant="secondary" />
      </li>
    })}</ol>
  </section>
}

function Assignments({ items, band }: { items: HomeAssignment[]; band: LearnBand }) {
  if (items.length === 0) return null
  return <section aria-labelledby="assignments" className={styles.assignments}>
    <h2 id="assignments">{band === 'kids' ? 'From your teacher' : 'Assigned to you'}</h2>
    <ul className="grid gap-3 md:grid-cols-2">{items.map(item => {
      const due = dueLabel(item.dueAt, band)
      const href = linkHref(item.link)
      return <li key={item.planId} className="ds-card space-y-2" data-testid="assignment">
        <h3 className="break-words font-bold">{item.title}</h3>
        <p className="text-[length:var(--ds-small)] text-muted-foreground">{[item.teacherName ? `From ${item.teacherName}` : 'From your teacher', item.className].filter(Boolean).join(' · ')}</p>
        {due && <p className={cn('text-[length:var(--ds-small)]', due.overdue && band !== 'kids' && 'font-bold text-destructive')}>{due.text}</p>}
        {band === 'kids' ? <StepDots progress={item.progress} label="steps" /> : item.progress.total > 0 && <ProgressBar label="Steps done" value={item.progress.done} max={item.progress.total} />}
        {href ? <Link href={href} className="ds-button ds-button-secondary">Open {band === 'kids' ? 'it' : 'assignment'}</Link> : <p className="text-sm text-muted-foreground">This assignment cannot be opened right now.</p>}
      </li>
    })}</ul>
  </section>
}

function SubjectProgressList({ subjects }: { subjects: SubjectProgress[] }) {
  if (subjects.length === 0) return null
  return <section aria-labelledby="subjects" className={styles.subjects}>
    <div className="flex flex-wrap items-center gap-3"><h2 id="subjects">Your subjects</h2><MeasuredTag>Measured progress</MeasuredTag></div>
    <ul className={styles.subjectList}>{subjects.map(subject => <li key={subject.subjectId} className={styles.subjectItem} data-testid="subject-progress">
      <h3 className="break-words font-bold">{subject.name}</h3>
      {subject.itemsTotal > 0 ? <ProgressBar label="Items done" value={subject.itemsDone} max={subject.itemsTotal} /> : <p className="text-muted-foreground">Nothing planned yet</p>}
      {subject.masteryPercent !== null && <p className="text-[length:var(--ds-small)] font-bold" data-testid="mastery">Mastery {Math.round(subject.masteryPercent)}%</p>}
    </li>)}</ul>
  </section>
}

function Countdown({ exam }: { exam: NonNullable<LearnHome['examCountdown']> }) {
  return <section aria-labelledby="exam" data-testid="exam-countdown" className={styles.countdown}>
    <span className={styles.iconTile}><CalendarClock size={22} aria-hidden="true" className="text-primary" /></span>
    <div className="min-w-0"><h2 id="exam" className="break-words">{exam.label} {daysLabel(exam.daysLeft)}</h2><p className="text-[length:var(--ds-small)] text-muted-foreground">Your plan&rsquo;s exam date</p></div>
  </section>
}

function Suggestion({ state, band }: { state: LearnHome['recommendation']; band: LearnBand }) {
  if (state.status !== 'AVAILABLE' || state.items.length === 0) return null
  const item: Recommendation = state.items[0]!
  const href = linkHref(item.link)
  return <section aria-labelledby="co-suggestion" data-testid="recommendation" className={styles.suggestion}>
    <div className={styles.coByline}><CoAvatar band={band} size={32} /><CoSuggestionTag /></div>
    <h2 id="co-suggestion">{item.title}</h2>
    <p className="text-muted-foreground">{item.reason}</p>
    <p className="text-[length:var(--ds-caption)] text-muted-foreground">A suggestion from Co, not a score. Your measured progress is shown separately.</p>
    {href && <Link href={href} className="ds-button ds-button-secondary">See it</Link>}
  </section>
}

function Recent({ items }: { items: LearnHome['recentMaterials'] }) {
  if (items.length === 0) return null
  return <section aria-labelledby="recent" className={styles.recent}>
    <h2 id="recent">Recent material</h2>
    <ul className={styles.materialList}>{items.map(item => {
      const status = materialStatusText(item.status)
      return <li key={item.id}><FileText size={20} strokeWidth={1.8} aria-hidden="true" className="text-primary" /><div><Link href={`/learn/import?material=${encodeURIComponent(item.id)}`} className="break-words font-bold hover:underline">{item.title}</Link>{status && <p className="text-[length:var(--ds-small)] text-muted-foreground">{status}</p>}</div><ArrowUpRight size={16} aria-hidden="true" className="text-muted-foreground" /></li>
    })}</ul>
  </section>
}

function Chips({ data, band }: { data: LearnHome; band: LearnBand }) {
  const streak = data.streak && data.streak.currentDays > 0 ? data.streak.currentDays : null
  const reviews = band !== 'kids' && data.dueReviewCount > 0 ? data.dueReviewCount : null
  if (!streak && !reviews) return null
  return <div className="flex flex-wrap gap-3">
    {streak && band !== 'kids' && <RewardBadge kind="streak" label={`${streak} day streak`} />}
    {reviews && <span className="ds-pill" data-testid="due-reviews"><RefreshCw size={16} aria-hidden="true" />{reviews} {reviews === 1 ? 'review' : 'reviews'} due</span>}
  </div>
}

/** B10: the entry to guided homework help (L18). Co guides; the learner finds the answer. */
const homeworkWords: Record<LearnBand, { title: string; line: string }> = {
  kids: { title: 'Homework help', line: 'Co helps you work it out' },
  tweens: { title: 'Homework help', line: 'Co guides you step by step. You find the answer.' },
  teens: { title: 'Homework help', line: 'Stuck on a problem? Co guides you; you work out the answer.' },
}
export function HomeworkHelpCard({ band }: { band: LearnBand }) {
  const words = homeworkWords[band]
  const kids = band === 'kids'
  return <Link href="/learn/homework" data-testid="homework-help-card" className={cn('ds-card flex items-center gap-4', styles.homework, kids ? 'min-h-32 text-[length:var(--ds-h3)] font-extrabold' : 'min-h-16')}>
    <PencilLine size={kids ? 44 : 28} aria-hidden="true" className="flex-none text-primary" />
    <span className="min-w-0"><span className="block font-extrabold">{words.title}</span><span className={cn('block break-words font-normal text-muted-foreground', 'text-[length:var(--ds-small)]')}>{words.line}</span></span>
    <ArrowUpRight size={20} aria-hidden="true" className={styles.helpArrow} />
  </Link>
}

/* ---------- band layouts ---------- */

function KidsHome({ data, limited }: { data: LearnHome; limited: boolean }) {
  return <>
    <div className="flex flex-wrap items-center gap-6">
      <CoCharacter band="kids" state={limited ? 'sleepy' : 'waving'} decorative className="size-32 sm:size-[220px]" />
      <SpeechBubble className="min-w-[14rem] max-w-xl flex-1">{greeting('kids', data.learner.displayName, data.nextAction)}</SpeechBubble>
    </div>
    {data.timeBudget && <TimePill minutes={data.timeBudget.minutesLeftToday} />}
    {data.nextAction && <NextActionCard action={data.nextAction} band="kids" limited={limited} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href="/learn/snap" className="ds-card flex min-h-32 items-center gap-4 text-[length:var(--ds-h3)] font-extrabold"><Camera size={44} aria-hidden="true" className="text-primary" />Snap something new</Link>
      <Link href="/learn/practice" className="ds-card flex min-h-32 items-center gap-4 text-[length:var(--ds-h3)] font-extrabold"><Gamepad2 size={44} aria-hidden="true" className="text-primary" />Play</Link>
      <HomeworkHelpCard band="kids" />
    </div>
    <Assignments items={data.assignments} band="kids" />
    <Suggestion state={data.recommendation} band="kids" />
  </>
}

function OlderHome({ data, limited, band }: { data: LearnHome; limited: boolean; band: 'tweens' | 'teens' }) {
  return <>
    <div className={styles.overviewLine}>
      <p>A little focus. A little curiosity. Your next step starts here.</p>
      <div className="flex flex-wrap items-center gap-3">{data.timeBudget && <TimePill minutes={data.timeBudget.minutesLeftToday} />}<Chips data={data} band={band} /></div>
    </div>
    <div className={styles.columns}>
      <div className={styles.mainColumn}>
        {data.nextAction && <NextActionCard action={data.nextAction} band={band} limited={limited} />}
        {data.todayPlan && <TodayPlan plan={data.todayPlan} band={band} limited={limited} />}
        <Assignments items={data.assignments} band={band} />
        <Recent items={data.recentMaterials} />
      </div>
      <div className={styles.sideColumn}>
        {band === 'teens' && data.examCountdown && <Countdown exam={data.examCountdown} />}
        <HomeworkHelpCard band={band} />
        <Suggestion state={data.recommendation} band={band} />
        {band === 'teens' && <SubjectProgressList subjects={data.subjectProgress} />}
      </div>
    </div>
  </>
}

function TweensHome(props: { data: LearnHome; limited: boolean }) { return <OlderHome {...props} band="tweens" /> }
function TeensHome(props: { data: LearnHome; limited: boolean }) { return <OlderHome {...props} band="teens" /> }

/** Every learner surface in one place, so a learner who just signed in is never left with a single button. */
const learnerSurfaces = [
  { href: '/learn', label: 'My plans', icon: BookOpen },
  { href: '/learn/library', label: 'Library', icon: Library },
  { href: '/learn/practice', label: 'Practice', icon: RefreshCw },
  { href: '/learn/teach', label: 'Teach it back', icon: Mic },
  { href: '/learn/progress', label: 'My progress', icon: ChartNoAxesColumnIncreasing },
  { href: '/learn/homework', label: 'Ask Co', icon: MessageCircle },
]
export function LearnerSurfaceLinks() {
  return <nav aria-label="More ways to learn" data-testid="learner-surfaces" className={styles.tools}>
    <h2 className="font-bold">More ways to learn</h2>
    <ul>{learnerSurfaces.map(({ icon: Icon, ...item }) => <li key={item.href}><Link href={item.href}><Icon size={21} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span><ArrowUpRight size={14} aria-hidden="true" /></Link></li>)}</ul>
  </nav>
}

/** Pure presentation of one /learn/home response. No fetching, no canned data. */
export function LearnHomeView({ data }: { data: LearnHome }) {
  const band = bandFromApi(data.band)
  const limited = data.state === 'LIMIT_REACHED'
  const Body = band === 'kids' ? KidsHome : band === 'tweens' ? TweensHome : TeensHome
  return <LearnFrame band={band} label="Home" className={styles.dashboard}>
    {band === 'kids' ? <h1 className="sr-only">Home for {data.learner.displayName}</h1> : <header className={styles.welcome}>
      <div><p className={styles.eyebrow}>YOUR LEARNING SPACE</p><h1>Hi {data.learner.displayName}. <span>Let’s make it click.</span></h1></div>
      <Link href="/learn/import" className="ds-button ds-button-secondary"><Plus size={18} aria-hidden="true" />Add material</Link>
    </header>}
    {data.state === 'FIRST_TIME' ? <>
      {data.timeBudget && <TimePill minutes={data.timeBudget.minutesLeftToday} />}
      <FirstTime band={band} />
    </> : <>{limited && <LimitBanner band={band} />}<Body data={data} limited={limited} />{band !== 'kids' && <LearnerSurfaceLinks />}</>}
  </LearnFrame>
}

export function LearnHomeSkeleton({ band = 'teens' }: { band?: LearnBand }) {
  return <LearnSkeleton band={band} label="Loading your home" />
}

export function LearnHomeScreen(): ReactNode {
  const { band } = useLearnIdentity()
  const query = useLearnHome()
  if (query.isPending) return <LearnHomeSkeleton band={band ?? 'teens'} />
  if (query.error) return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={band ?? 'teens'} backHref="/learn" backLabel="Open Learn" />
  return <LearnHomeView data={query.data} />
}
