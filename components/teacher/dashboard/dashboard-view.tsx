'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookPlus, FilePlus2, UsersRound } from 'lucide-react'
import { EmptyState, LoadingState } from '@/components/design-system'
import { useTeachingResource } from '@/components/teacher/teaching-context'
import { TeacherPage } from '@/components/teacher/teacher-page'
import {
  assignablePlanId,
  createLessonTarget,
  parseTeachingDashboard,
  type TeachingDashboard,
} from '@/lib/api/teaching/dashboard'
import { cn } from '@/lib/utils'
import { AssignDialog } from './assign-dialog'
import { TeachingFailurePanel } from './failure-panel'
import {
  DraftsToFinish,
  DueThisWeek,
  LaterReleasePanel,
  PlanProgress,
  RecentActivity,
  SetupChecklist,
  ThisWeek,
} from './panels'

const actionClass =
  'inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'

function QuickAction({
  label,
  icon: Icon,
  href,
  onClick,
  disabledReason,
  testId,
  primary,
}: {
  label: string
  icon: typeof BookPlus
  href?: string | null
  onClick?: () => void
  disabledReason?: string | null
  testId: string
  primary?: boolean
}) {
  const enabled = !disabledReason && (href || onClick)
  if (!enabled) {
    return (
      <div className="flex flex-col gap-1">
        <button type="button" disabled aria-disabled="true" data-testid={testId} className={cn(actionClass, 'cursor-not-allowed border-dashed border-border text-muted-foreground')}>
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </button>
        {disabledReason && <span data-testid={`${testId}-reason`} className="max-w-56 text-xs text-muted-foreground">{disabledReason}</span>}
      </div>
    )
  }
  const tone = primary ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'
  return href ? (
    <Link href={href} data-testid={testId} className={cn(actionClass, tone)}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </Link>
  ) : (
    <button type="button" onClick={onClick} data-testid={testId} className={cn(actionClass, tone)}>
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

export function TeacherDashboardView() {
  const { resource, reload } = useTeachingResource('/dashboard', parseTeachingDashboard)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignedNote, setAssignedNote] = useState<string | null>(null)

  if (resource.status === 'loading') {
    return (
      <TeacherPage title="Teacher dashboard">
        <div data-testid="t1-loading"><LoadingState label="Loading your classroom…" /></div>
      </TeacherPage>
    )
  }
  if (resource.status === 'error') {
    return (
      <TeacherPage title="Teacher dashboard">
        <TeachingFailurePanel kind={resource.kind} message={resource.message} onRetry={reload} testId="t1-failure" />
      </TeacherPage>
    )
  }
  const dashboard: TeachingDashboard = resource.data
  const noClass = dashboard.state === 'NO_CLASS'
  const lessonTarget = createLessonTarget(dashboard)
  const assignPlan = assignablePlanId(dashboard)
  const assignItem = dashboard.checklist.find((entry) => entry.key === 'INVITE_STUDENTS')
  const noClassReason = 'No class is assigned to you yet.'

  return (
    <TeacherPage title={`Hello, ${dashboard.teacher.displayName}`} subtitle={dashboard.school.name}>
      <div data-testid="t1-root" data-state={dashboard.state} className="space-y-5">
        <section aria-label="Your classes" className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            <span data-testid="t1-school">{dashboard.school.name}</span>
          </p>
          {dashboard.classes.length > 0 && (
            <ul data-testid="t1-classes" className="flex flex-wrap gap-2">
              {dashboard.classes.map((cls) => (
                <li key={cls.classId} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
                  <span className="font-semibold">{cls.label}</span>
                  <span className="ms-2 text-xs text-muted-foreground">
                    {cls.subjects.map((subject) => subject.subject).join(', ')} · {cls.rosterCount} students
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Quick actions" className="flex flex-wrap items-start gap-3">
          <QuickAction
            testId="t1-action-lesson"
            label="Create lesson"
            icon={FilePlus2}
            href={lessonTarget}
            disabledReason={noClass ? noClassReason : lessonTarget ? null : 'Create a plan first, then add lessons to its topics.'}
            primary
          />
          <QuickAction testId="t1-action-plan" label="New plan" icon={BookPlus} href="/teacher/plans/new" disabledReason={noClass ? noClassReason : null} />
          <QuickAction
            testId="t1-action-assign"
            label="Assign to class"
            icon={UsersRound}
            onClick={assignPlan ? () => setAssignOpen(true) : undefined}
            disabledReason={
              noClass
                ? noClassReason
                : assignPlan
                  ? null
                  : assignItem?.action.disabledReason ?? 'Publish a plan first.'
            }
          />
        </section>

        {assignedNote && (
          <p role="status" data-testid="t1-assigned-note" className="rounded-xl border border-border bg-muted/40 p-3 text-sm font-semibold">
            {assignedNote}
          </p>
        )}

        {noClass ? (
          <div data-testid="t1-no-class">
            <EmptyState
              band="adults"
              title="No class is assigned to you yet"
              description="Your school administrator assigns you to a class and subject. Once they do, you can create plans here. Nothing is wrong with your account."
            />
          </div>
        ) : (
          <>
            {dashboard.state === 'NEW_TEACHER' && (
              <div data-testid="t1-new-teacher" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Welcome. You have not made a plan yet.{' '}
                  <Link href="/teacher/onboarding" className="font-semibold text-primary underline">Walk me through it</Link>
                </p>
              </div>
            )}
            {(dashboard.state === 'NEW_TEACHER' || dashboard.checklist.some((entry) => !entry.done)) && (
              <SetupChecklist dashboard={dashboard} onAssign={() => setAssignOpen(true)} />
            )}
            {dashboard.state === 'ACTIVE' && (
              <div className="grid gap-5 lg:grid-cols-2">
                <ThisWeek dashboard={dashboard} />
                <DueThisWeek dashboard={dashboard} />
                <PlanProgress dashboard={dashboard} />
                <RecentActivity dashboard={dashboard} />
              </div>
            )}
            {dashboard.drafts.length > 0 && <DraftsToFinish dashboard={dashboard} />}
            <div className="grid gap-5 lg:grid-cols-3">
              <LaterReleasePanel testId="t1-later-at-risk" title="Concepts students struggle with" reason={dashboard.deferred.atRiskAlerts.reason} />
              <LaterReleasePanel testId="t1-later-worksheets" title="Worksheet drafts to review" reason={dashboard.deferred.worksheetDrafts.reason} />
              <LaterReleasePanel testId="t1-later-practice" title="Assign extra practice" reason={dashboard.deferred.extraPractice.reason} />
            </div>
          </>
        )}
      </div>
      {assignPlan && (
        <AssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          planId={assignPlan}
          onAssigned={(assignment) => {
            // Only after the server answered: the panel calls this on success.
            setAssignOpen(false)
            setAssignedNote(`Assigned to ${assignment.classLabel}.`)
            reload()
          }}
        />
      )}
    </TeacherPage>
  )
}
