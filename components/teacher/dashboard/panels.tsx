'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { CalendarClock, CheckCircle2, Circle, Clock3, FileText, LockKeyhole } from 'lucide-react'
import { ProgressBar } from '@/components/design-system'
import { cn } from '@/lib/utils'
import type { TeachingDashboard } from '@/lib/api/teaching/dashboard'

export const formatDay = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function Panel({
  title,
  description,
  children,
  testId,
  tone = 'default',
  headingLevel = 2,
}: {
  title: string
  description?: string
  children: ReactNode
  testId?: string
  tone?: 'default' | 'measured' | 'later'
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <section
      data-testid={testId}
      aria-labelledby={testId ? `${testId}-title` : undefined}
      className={cn(
        'rounded-2xl border p-5',
        tone === 'later' ? 'border-dashed border-border bg-muted/30' : 'border-border bg-card',
      )}
    >
      <Heading id={testId ? `${testId}-title` : undefined} className="text-base font-extrabold">
        {title}
      </Heading>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Honest "arrives later" panel: no zeros, no sample data, the server's reason shown as text. */
export function LaterReleasePanel({ title, reason, testId }: { title: string; reason: string; testId: string }) {
  return (
    <Panel title={title} tone="later" testId={testId}>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-semibold text-foreground">Arrives in a later release.</strong> {reason}
        </span>
      </p>
    </Panel>
  )
}

export function MeasuredStat({ label, value, note, testId }: { label: string; value: string; note?: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-border bg-background p-4">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-extrabold">{value}</dd>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

export function ThisWeek({ dashboard }: { dashboard: TeachingDashboard }) {
  const { activity, plans } = dashboard
  const enough = activity.evidence === 'ENOUGH' && activity.activeLearners !== null
  return (
    <Panel
      title="This week"
      description={`Measured from ${formatDay(dashboard.week.from)} to ${formatDay(dashboard.week.to)}. Learners who have not shared progress with teachers are left out.`}
      testId="t1-this-week"
      tone="measured"
    >
      <dl className="grid gap-3 sm:grid-cols-3">
        <MeasuredStat
          testId="t1-active"
          label="Active students"
          value={enough ? `${activity.activeLearners} of ${activity.enrolledLearners}` : 'No data yet'}
          note={enough ? 'Completed a practice session on your plans in the last 7 days.' : 'No student has an active enrolment on your plans yet.'}
        />
        <MeasuredStat testId="t1-plans-published" label="Published plans" value={String(plans.published)} />
        <MeasuredStat testId="t1-plans-draft" label="Draft plans" value={String(plans.draft)} note={plans.archived ? `${plans.archived} archived` : undefined} />
      </dl>
    </Panel>
  )
}

export function DueThisWeek({ dashboard }: { dashboard: TeachingDashboard }) {
  return (
    <Panel title="Due this week" testId="t1-due">
      {dashboard.dueThisWeek.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is due this week. Set a due date on a topic in the plan editor.</p>
      ) : (
        <ul className="space-y-2">
          {dashboard.dueThisWeek.map((item) => (
            <li key={`${item.planId}:${item.topicId}`}>
              <Link
                href={`/teacher/plans/${encodeURIComponent(item.planId)}/topics/${encodeURIComponent(item.topicId)}`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 hover:bg-muted/50"
              >
                <span className="min-w-0 break-words">
                  <span className="block font-semibold">{item.topicTitle}</span>
                  <span className="block text-xs text-muted-foreground">{item.planTitle}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                  <CalendarClock aria-hidden="true" className="size-4" />
                  {formatDay(item.dueAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function PlanProgress({ dashboard }: { dashboard: TeachingDashboard }) {
  return (
    <Panel
      title="Plan progress"
      description="Average progress needs at least 3 active students, so a small class is never shown as zero."
      testId="t1-progress"
      tone="measured"
    >
      {dashboard.planProgress.length === 0 ? (
        <p className="text-sm text-muted-foreground">Progress appears here once a published plan is assigned to a class.</p>
      ) : (
        <ul className="space-y-3">
          {dashboard.planProgress.map((plan) => (
            <li key={plan.planId} data-testid="t1-progress-row" className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/teacher/plans/${encodeURIComponent(plan.planId)}`} className="font-semibold underline-offset-2 hover:underline">
                  {plan.title}
                </Link>
                <span className="text-xs text-muted-foreground">{plan.classLabel}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.enrolledActive} active
                {plan.pendingGuardian > 0 && <> · {plan.pendingGuardian} waiting for guardian approval</>}
              </p>
              {plan.averageProgress === null ? (
                <p data-testid="t1-progress-insufficient" className="mt-2 text-xs font-semibold text-muted-foreground">
                  Not enough data yet. Needs 3 active students.
                </p>
              ) : (
                <div className="mt-2">
                  <ProgressBar value={Math.round(plan.averageProgress)} label={`Average progress for ${plan.title}`} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function DraftsToFinish({ dashboard }: { dashboard: TeachingDashboard }) {
  return (
    <Panel title="Drafts to finish" description="Your own unfinished plans and lessons. Written by you." testId="t1-drafts">
      {dashboard.drafts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No unfinished drafts.</p>
      ) : (
        <ul className="space-y-2">
          {dashboard.drafts.map((draft) => (
            <li key={`${draft.kind}:${draft.planId}:${draft.topicId ?? ''}`}>
              <Link
                href={
                  draft.kind === 'LESSON' && draft.topicId
                    ? `/teacher/plans/${encodeURIComponent(draft.planId)}/topics/${encodeURIComponent(draft.topicId)}`
                    : `/teacher/plans/${encodeURIComponent(draft.planId)}`
                }
                className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 py-2 hover:bg-muted/50"
              >
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 break-words font-semibold">{draft.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {draft.kind === 'PLAN' ? 'Plan draft' : 'Lesson draft'} · {formatDay(draft.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const RECENT_LABEL: Record<TeachingDashboard['recent'][number]['kind'], string> = {
  PLAN_PUBLISHED: 'Plan published',
  LESSON_PUBLISHED: 'Lesson published',
  ENROLMENT_JOINED: 'Joined',
  ENROLMENT_PENDING_GUARDIAN: 'Waiting for guardian approval',
}

export function RecentActivity({ dashboard }: { dashboard: TeachingDashboard }) {
  return (
    <Panel title="Recent activity" description="Last 14 days, on your own plans. Student names are the nicknames your school uses." testId="t1-recent" tone="measured">
      {dashboard.recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {dashboard.recent.map((event, index) => (
            <li key={`${event.kind}:${event.planId}:${event.at}:${index}`} className="flex items-start gap-3 text-sm">
              <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 break-words">
                <strong className="font-semibold">{event.learnerLabel ?? RECENT_LABEL[event.kind]}</strong>
                {event.learnerLabel ? ` · ${RECENT_LABEL[event.kind].toLowerCase()}` : ''}
                {' · '}
                {event.label}
                <span className="ms-2 text-xs text-muted-foreground">{formatDay(event.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

const CHECKLIST_COPY: Record<TeachingDashboard['checklist'][number]['key'], { title: string; hint: string }> = {
  CREATE_PLAN: { title: 'Create your first plan', hint: 'Start from scratch or from the school curriculum.' },
  ADD_MATERIAL: { title: 'Add material', hint: 'Upload a file, add a link or take a photo for a topic.' },
  INVITE_STUDENTS: { title: 'Invite students', hint: 'Assign a published plan to a class. Invite codes and links arrive in a later release.' },
}

export function SetupChecklist({
  dashboard,
  onAssign,
}: {
  dashboard: TeachingDashboard
  onAssign: () => void
}) {
  return (
    <Panel title="Set up your class" description="Three steps. Each one is real: it opens the screen that does it." testId="t1-checklist">
      <ol className="space-y-3">
        {dashboard.checklist.map((item) => {
          const copy = CHECKLIST_COPY[item.key]
          const Icon = item.done ? CheckCircle2 : Circle
          return (
            <li key={item.key} data-testid={`t1-check-${item.key}`} data-done={item.done} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <Icon aria-hidden="true" className={cn('size-5 shrink-0', item.done ? 'text-primary' : 'text-muted-foreground')} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {copy.title}
                  <span className="sr-only">{item.done ? ' (done)' : ' (to do)'}</span>
                </p>
                <p className="text-xs text-muted-foreground">{item.action.enabled ? copy.hint : item.action.disabledReason ?? copy.hint}</p>
              </div>
              {!item.done && item.action.enabled && item.action.route && (
                item.key === 'INVITE_STUDENTS' ? (
                  <button type="button" onClick={onAssign} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">
                    Assign to a class
                  </button>
                ) : (
                  <Link href={item.action.route} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted">
                    Open
                  </Link>
                )
              )}
              {!item.done && !item.action.enabled && (
                <span aria-disabled="true" className="inline-flex min-h-11 items-center rounded-xl border border-dashed border-border px-4 text-sm text-muted-foreground">
                  Not yet
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}
