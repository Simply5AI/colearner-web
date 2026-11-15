'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarOff, ChevronLeft, ChevronRight, Lock, RefreshCw } from 'lucide-react'
import {
  applyScheduleChange,
  downloadScheduleCalendar,
  getTutorSchedule,
  groupScheduleByDay,
  isoWeekday,
  previewScheduleDayOff,
  previewScheduleMove,
  previewScheduleReplan,
  scheduleConflictMessage,
  type TutorSchedulePreviewResponse,
  type TutorScheduleResponse,
} from '@/lib/api/tutor-loop/schedule'
import { getStudyPreferences } from '@/lib/api/tutor-loop/profile'
import { formatStudyDuration, getTutorToday, resolveTutorActionHref, type TutorScheduleItem } from '@/lib/api/tutor-loop/today'
import { addCalendarDays, formatTutorDate, formatTutorDateRange, isoWeekRange, todayCalendarDate } from '@/lib/tutor-loop/date'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import { coArt, itemKindLabel, useTutorIdentity } from '@/components/tutor-loop/today/tutor-identity'
import { todayKey } from '@/components/tutor-loop/today/today-tab'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const dayName = (date: string) => DAY_NAMES[isoWeekday(date) - 1]!
const dayNumber = (date: string) => Number(date.slice(8, 10))
export const scheduleKey = (workspace: string, from: string, to: string) => ['tutor-schedule', workspace, from, to] as const

type Plan =
  | { kind: 'move'; item: TutorScheduleItem; to: string; preview: TutorSchedulePreviewResponse }
  | { kind: 'dayOff'; date: string; off: boolean; preview: TutorSchedulePreviewResponse }
  | { kind: 'replan'; preview: TutorSchedulePreviewResponse }

function useNarrow() {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(max-width: 639px)')
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return narrow
}

/** Minutes and counts per date before and after a preview, limited to dates in view. */
export function summariseChanges(schedule: TutorScheduleResponse, preview: TutorSchedulePreviewResponse, dates: readonly string[]) {
  const itemsById = new Map(schedule.items.map((i) => [i.id, i]))
  const before = new Map<string, { n: number; min: number }>()
  const after = new Map<string, { n: number; min: number }>()
  const bump = (map: typeof before, date: string, min: number) => {
    const cur = map.get(date) ?? { n: 0, min: 0 }
    map.set(date, { n: cur.n + 1, min: cur.min + min })
  }
  let outside = 0
  for (const change of preview.changes) {
    const item = itemsById.get(change.itemId)
    const minutes = item?.estimatedMinutes ?? 0
    if (change.from && dates.includes(change.from)) bump(before, change.from, minutes)
    if (change.to && dates.includes(change.to)) bump(after, change.to, minutes)
    if (!(change.from && dates.includes(change.from)) && !(change.to && dates.includes(change.to))) outside += 1
  }
  const touched = [...new Set([...before.keys(), ...after.keys()])].sort()
  const rows = touched.map((date) => {
    const base = groupScheduleByDay([date], schedule.items, schedule.daysOff)[0]!
    const b = before.get(date) ?? { n: 0, min: 0 }
    const a = after.get(date) ?? { n: 0, min: 0 }
    const nBefore = base.items.length
    const mBefore = base.minutes
    return { date, before: { n: nBefore, min: mBefore }, after: { n: nBefore - b.n + a.n, min: mBefore - b.min + a.min } }
  })
  return { rows, outside }
}

const countText = (v: { n: number; min: number }) => `${v.n} ${v.n === 1 ? 'thing' : 'things'} · ${formatStudyDuration(v.min)}`

function ItemCard({
  item, selected, onSelect, children,
}: { item: TutorScheduleItem; selected: boolean; onSelect: () => void; children?: React.ReactNode }) {
  const fixed = item.placement === 'FIXED' || item.kind === 'TEACHER_DUE'
  const status = item.status === 'DONE' ? 'Done' : item.status === 'SKIPPED' ? 'Skipped' : item.placement === 'MANUAL' ? 'Moved by you' : fixed ? 'Set by your teacher' : ''
  return (
    <div className={`rounded-[var(--ds-radius,0.75rem)] border-2 ${selected ? 'border-primary' : 'border-border'} bg-card`}>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        data-testid="schedule-item"
        className="flex w-full flex-col gap-0.5 p-2.5 text-left"
      >
        <span className="text-xs font-bold text-muted-foreground">{itemKindLabel(item.kind)}</span>
        <b className="text-sm [overflow-wrap:anywhere]">{item.title}</b>
        <span className="text-xs text-muted-foreground">{formatStudyDuration(item.estimatedMinutes)}{status ? ` · ${status}` : ''}</span>
      </button>
      {selected && <div className="flex flex-col gap-2 border-t border-border p-2.5">{children}</div>}
    </div>
  )
}

export function ScheduleTab({ onOpenToday }: { onOpenToday?: () => void } = {}) {
  void onOpenToday
  const { workspace, tutorName, tutorIcon, adult } = useTutorIdentity()
  const client = useQueryClient()
  const narrow = useNarrow()
  const options = { workspace }
  const [offset, setOffset] = useState(0)
  const [dayIdx, setDayIdx] = useState<number | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [moveTo, setMoveTo] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [offPicker, setOffPicker] = useState(false)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null)

  const todayQuery = useQuery({ queryKey: todayKey(workspace, null), queryFn: () => getTutorToday({}, options), retry: false })
  const today = todayQuery.data?.date ?? (todayQuery.isError ? todayCalendarDate() : null)
  const week = useMemo(() => {
    if (!today) return null
    const base = isoWeekRange(today)
    const from = addCalendarDays(base.from, offset * 7)
    return { from, to: addCalendarDays(from, 6), dates: Array.from({ length: 7 }, (_, i) => addCalendarDays(from, i)) }
  }, [today, offset])

  const schedule = useQuery({
    queryKey: week ? scheduleKey(workspace, week.from, week.to) : ['tutor-schedule', 'idle'],
    queryFn: () => getTutorSchedule({ from: week!.from, to: week!.to }, options),
    enabled: !!week,
    retry: false,
  })
  const prefs = useQuery({ queryKey: ['tutor-study-preferences', workspace], queryFn: () => getStudyPreferences(options), retry: false })

  useEffect(() => {
    if (!week || !today) return
    const idx = week.dates.indexOf(today)
    setDayIdx(idx >= 0 ? idx : 0)
    setSelected(null)
    setPlan(null)
  }, [week?.from]) // eslint-disable-line react-hooks/exhaustive-deps

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['tutor-schedule'] })
    void client.invalidateQueries({ queryKey: ['tutor-today'] })
    void client.invalidateQueries({ queryKey: ['tutor-progress'] })
  }

  const preview = useMutation({
    mutationFn: async (next: { kind: 'move'; item: TutorScheduleItem; to: string } | { kind: 'dayOff'; date: string; off: boolean } | { kind: 'replan' }): Promise<Plan> => {
      const base = schedule.data!.revision
      if (next.kind === 'move') return { ...next, preview: await previewScheduleMove({ itemId: next.item.id, date: next.to, baseRevision: base }, options) }
      if (next.kind === 'dayOff') return { ...next, preview: await previewScheduleDayOff({ baseRevision: base, startDate: next.date, endDate: next.date, dayOff: next.off }, options) }
      return { kind: 'replan', preview: await previewScheduleReplan({ baseRevision: base, reason: 'BEHIND' }, options) }
    },
    onSuccess: (result) => setPlan(result),
  })

  const apply = useMutation({
    mutationFn: (target: Plan) => applyScheduleChange(target.preview.id, { clientRequestId: crypto.randomUUID(), baseRevision: target.preview.baseRevision }, options),
    onSuccess: (_result, target) => {
      invalidate()
      setPlan(null)
      setSelected(null)
      setOffPicker(false)
      if (target.kind === 'move') {
        const from = target.item.date
        setNotice({
          text: `Moved to ${dayName(target.to)}.`,
          undo: () => {
            void (async () => {
              try {
                const latest = await getTutorSchedule({ from: week!.from, to: week!.to }, options)
                const back = await previewScheduleMove({ itemId: target.item.id, date: from, baseRevision: latest.revision }, options)
                if (back.canApply) {
                  await applyScheduleChange(back.id, { clientRequestId: crypto.randomUUID(), baseRevision: back.baseRevision }, options)
                  setNotice({ text: 'Move undone.' })
                } else setNotice({ text: 'That move could not be undone.' })
              } catch {
                setNotice({ text: 'That move could not be undone.' })
              }
              invalidate()
            })()
          },
        })
      } else if (target.kind === 'dayOff') {
        setNotice({ text: target.off ? `${dayName(target.date)} is now a day off.` : `${dayName(target.date)} is a study day again.` })
      } else setNotice({ text: 'New plan saved.' })
    },
  })

  const calendar = useMutation({ mutationFn: () => downloadScheduleCalendar({ from: week!.from, to: week!.to }) })

  if (!week || todayQuery.isPending) {
    return <p role="status" className="text-muted-foreground" data-state="loading">Loading your week…</p>
  }
  if (schedule.isPending) {
    return (
      <div role="status" data-state="loading" className="flex flex-col gap-3">
        <span className="sr-only">Loading your week</span>
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-56 animate-pulse rounded-[var(--ds-radius,1rem)] bg-muted" />
      </div>
    )
  }
  if (schedule.isError) {
    return (
      <div role="alert" className="ds-card flex flex-col items-start gap-3" data-state="error">
        <b>Your week could not be loaded</b>
        <p className="text-sm text-muted-foreground">{friendlyError(schedule.error, 'Check your connection and try again.').message}</p>
        <button type="button" className="ds-button ds-button-primary" onClick={() => void schedule.refetch()}>Try again</button>
      </div>
    )
  }

  const data = schedule.data
  const days = groupScheduleByDay(week.dates, data.items, data.daysOff)
  const studyDays = prefs.data?.studyDays
  const isStudyDay = (date: string) => !studyDays || studyDays.includes(isoWeekday(date))
  const future = (date: string) => !!today && date >= today
  const planned = data.items.filter((i) => i.status === 'PLANNED' || i.status === 'DONE')
  const doneMin = planned.filter((i) => i.status === 'DONE').reduce((s, i) => s + i.estimatedMinutes, 0)
  const totalMin = planned.reduce((s, i) => s + i.estimatedMinutes, 0)
  const shownDays = narrow ? [days[dayIdx ?? 0] ?? days[0]!] : days
  const busy = preview.isPending || apply.isPending
  const error = preview.error ?? apply.error ?? null
  const moveTargets = days.filter((d) => future(d.date) && !d.dayOff && isStudyDay(d.date))
  const emptyWeek = data.items.length === 0 && data.daysOff.length === 0
  const pace = data.pace
  const itemTitle = (id: string) => data.items.find((i) => i.id === id)?.title ?? 'A study item'

  return (
    <div className="flex flex-col gap-4" data-state={emptyWeek ? 'empty' : 'ready'} aria-busy={schedule.isFetching}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="text-[length:var(--ds-h1,2rem)] font-black leading-tight tracking-tight">This week</h1>
          <span className="text-sm text-muted-foreground" data-testid="week-range">
            {formatTutorDateRange(week.from, week.to, { includeYear: false })}
            {totalMin > 0 ? ` · ${formatStudyDuration(doneMin)} of ${formatStudyDuration(totalMin)} done` : ''}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="ds-button ds-button-secondary" aria-label="Previous week" onClick={() => setOffset((o) => o - 1)}><ChevronLeft size={16} aria-hidden="true" /></button>
          <button type="button" className="ds-button ds-button-secondary" aria-label="Next week" onClick={() => setOffset((o) => o + 1)}><ChevronRight size={16} aria-hidden="true" /></button>
          {offset !== 0 && <button type="button" className="ds-button ds-button-secondary" onClick={() => setOffset(0)}>This week</button>}
          <button type="button" className="ds-button ds-button-secondary" aria-expanded={offPicker} onClick={() => { setOffPicker((v) => !v); setPlan(null) }}>
            <CalendarOff size={16} aria-hidden="true" /> Take a day off
          </button>
          <button type="button" className="ds-button ds-button-secondary" disabled={busy} onClick={() => { setOffPicker(false); preview.mutate({ kind: 'replan' }) }}>
            <RefreshCw size={16} aria-hidden="true" /> I’m behind · replan
          </button>
          {adult && (
            <button type="button" className="ds-button ds-button-secondary" disabled={calendar.isPending} onClick={() => calendar.mutate()}>Add to calendar</button>
          )}
        </div>
      </div>

      {calendar.isError && <p role="alert" className="text-sm text-destructive">{calendar.error instanceof Error && calendar.error.message ? calendar.error.message : 'The calendar file could not be made. Try again.'}</p>}

      {pace.state === 'BEHIND' && (
        <p role="status" className="rounded-[var(--ds-radius,0.75rem)] bg-[var(--co-surface,transparent)] p-3 text-sm" data-testid="pace-behind">
          You are about {formatStudyDuration(pace.shortfallMinutes)} short of finishing before your exam. Replanning can spread the work out.
        </p>
      )}
      {data.warnings.map((w) => (
        <p key={`${w.date}-${w.reasonCode}`} role="status" className="text-sm text-muted-foreground">
          {w.reasonCode === 'FIXED_ON_DAY_OFF'
            ? `Your teacher set ${formatTutorDate(w.date, { weekday: true, includeYear: false })}, which is a day off for you.`
            : `Your teacher’s work on ${formatTutorDate(w.date, { weekday: true, includeYear: false })} is more than your daily time.`}
        </p>
      ))}

      {offPicker && (
        <section className="ds-card flex flex-col gap-2" aria-label="Choose a day off">
          <b>Which day?</b>
          <div className="flex flex-wrap gap-2">
            {days.filter((d) => future(d.date)).map((d) => (
              <button key={d.date} type="button" className="min-h-10 rounded-full border-2 border-border px-4 font-bold" disabled={busy}
                aria-label={d.dayOff ? `Make ${dayName(d.date)} a study day again` : `Take ${dayName(d.date)} off`}
                onClick={() => preview.mutate({ kind: 'dayOff', date: d.date, off: !d.dayOff })}>
                {dayName(d.date)}{d.dayOff ? ' (off)' : ''}
              </button>
            ))}
          </div>
        </section>
      )}

      {plan && plan.kind !== 'move' && (() => {
        const summary = summariseChanges(data, plan.preview, week.dates)
        const heading = plan.kind === 'replan'
          ? plan.preview.changes.length ? 'Here’s a new plan for the rest of your schedule.' : 'Your schedule already fits. Nothing needs to change.'
          : plan.off ? `${dayName(plan.date)} off: ${plan.preview.changes.length} ${plan.preview.changes.length === 1 ? 'thing moves' : 'things move'}.` : `${dayName(plan.date)} becomes a study day again.`
        return (
          <section className="ds-card flex flex-col gap-3" aria-label="Schedule preview" data-testid="schedule-preview">
            <span className="flex items-center gap-2"><img src={coArt(tutorIcon, 'speaking')} alt="" width={36} height={36} /><b>{heading}</b></span>
            {summary.rows.length > 0 && (
              <ul className="flex flex-col gap-1 text-sm">
                {summary.rows.map((row) => (
                  <li key={row.date} className="flex flex-wrap gap-x-3"><b className="min-w-12">{dayName(row.date)}</b><span className="text-muted-foreground">{countText(row.before)}</span><span aria-hidden="true">→</span><span>{countText(row.after)}</span></li>
                ))}
              </ul>
            )}
            {summary.outside > 0 && <p className="text-sm text-muted-foreground">{summary.outside} more {summary.outside === 1 ? 'change' : 'changes'} in later weeks.</p>}
            {plan.preview.unplacedMinutes > 0 && <p className="text-sm text-destructive">{formatStudyDuration(plan.preview.unplacedMinutes)} of work does not fit before its deadline.</p>}
            {plan.preview.conflicts.map((c) => <p key={`${c.itemId}-${c.reasonCode}`} className="text-sm text-muted-foreground">{itemTitle(c.itemId)}: {scheduleConflictMessage(c.reasonCode)}</p>)}
            <div className="flex flex-wrap gap-2">
              {plan.preview.canApply && (plan.preview.changes.length > 0 || plan.kind === 'dayOff') && (
                <button type="button" className="ds-button ds-button-primary" disabled={busy} onClick={() => apply.mutate(plan)}>{plan.kind === 'replan' ? 'Use new plan' : plan.off ? 'Take the day off' : 'Make it a study day'}</button>
              )}
              <button type="button" className="ds-button ds-button-secondary" onClick={() => setPlan(null)}>{plan.kind === 'replan' ? 'Keep mine' : 'Cancel'}</button>
            </div>
          </section>
        )
      })()}

      {error && (
        <p role="alert" className="text-sm text-destructive" data-testid="schedule-error">
          {friendlyError(error, 'That change could not be made. Try again.').message}
        </p>
      )}
      {notice && (
        <p role="status" className="flex items-center gap-3 text-sm" data-testid="schedule-notice">
          {notice.text}
          {notice.undo && <button type="button" className="font-bold underline" onClick={() => { notice.undo!(); setNotice(null) }}>Undo</button>}
        </p>
      )}

      {narrow && (
        <div role="tablist" aria-label="Day" className="flex gap-1 overflow-x-auto">
          {days.map((d, i) => (
            <button key={d.date} role="tab" type="button" aria-selected={(dayIdx ?? 0) === i} onClick={() => setDayIdx(i)}
              className={`min-h-10 flex-1 rounded-full border-2 px-3 font-bold ${(dayIdx ?? 0) === i ? 'border-primary' : 'border-border'}`}>
              {dayName(d.date)}
            </button>
          ))}
        </div>
      )}

      {emptyWeek && (
        <div className="ds-card flex items-center gap-3" data-testid="schedule-empty">
          <img src={coArt(tutorIcon, 'idle')} alt="" width={56} height={56} />
          <div className="flex flex-col gap-1">
            <b>Nothing planned this week</b>
            <span className="text-sm text-muted-foreground">Add a goal or some material and {tutorName} will plan your study time.</span>
            <Link href="/learn?tab=library" className="underline text-sm">Add material</Link>
          </div>
        </div>
      )}

      <div className={narrow ? 'grid grid-cols-1 gap-3' : 'grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3'}>
        {shownDays.map((day) => {
          const isToday = day.date === today
          const limit = 3
          const open = expanded[day.date]
          const list = !open && day.items.length > limit ? day.items.slice(0, limit) : day.items
          const off = day.dayOff || !isStudyDay(day.date)
          return (
            <section key={day.date} aria-label={`${dayName(day.date)} ${dayNumber(day.date)}`} data-testid="schedule-day" data-today={isToday || undefined}
              className={`flex flex-col gap-2 rounded-[var(--ds-radius,1rem)] border-2 p-2 ${isToday ? 'border-primary' : 'border-transparent'} ${off ? 'bg-muted' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <b className={isToday ? 'text-primary' : undefined}>{dayName(day.date)} {dayNumber(day.date)}</b>
                <span className="text-xs text-muted-foreground">{day.minutes > 0 ? formatStudyDuration(day.minutes) : ''}</span>
              </div>
              {list.map((item) => {
                const fixed = item.placement === 'FIXED' || item.kind === 'TEACHER_DUE'
                const isSel = selected === item.id
                const movable = !fixed && item.status === 'PLANNED'
                return (
                  <ItemCard key={item.id} item={item} selected={isSel} onSelect={() => { setSelected(isSel ? null : item.id); setMoveTo(null); setPlan(null) }}>
                    {item.status === 'PLANNED' && (
                      <Link href={resolveTutorActionHref({ kind: item.kind, targetId: item.topicId }, item.goalId)} className="ds-button ds-button-primary">Start now</Link>
                    )}
                    {fixed && <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Lock size={14} aria-hidden="true" />Set by your teacher</span>}
                    {movable && (
                      <>
                        <b className="text-sm">Move to</b>
                        <div className="flex flex-wrap gap-1.5">
                          {moveTargets.filter((d) => d.date !== item.date).map((d) => (
                            <button key={d.date} type="button" aria-pressed={moveTo === d.date} disabled={busy}
                              className={`min-h-9 rounded-full border-2 px-3 text-sm font-bold ${moveTo === d.date ? 'border-primary' : 'border-border'}`}
                              onClick={() => { setMoveTo(d.date); preview.mutate({ kind: 'move', item, to: d.date }) }}>
                              {dayName(d.date)}
                            </button>
                          ))}
                          {moveTargets.filter((d) => d.date !== item.date).length === 0 && <span className="text-sm text-muted-foreground">No other study days left this week.</span>}
                        </div>
                        {plan?.kind === 'move' && plan.item.id === item.id && (
                          <div className="flex flex-col gap-1.5 text-sm" data-testid="move-consequence">
                            {plan.preview.canApply ? (
                              <>
                                <span>{dayName(plan.to)} gets about {formatStudyDuration(plan.item.estimatedMinutes)} longer.{' '}
                                  {plan.preview.changes.length > 1 ? `${plan.preview.changes.length - 1} other ${plan.preview.changes.length === 2 ? 'thing moves' : 'things move'}.` : 'Nothing else moves.'}</span>
                                {plan.preview.changes.filter((c) => c.itemId !== item.id).map((c) => (
                                  <span key={c.itemId} className="text-muted-foreground">{itemTitle(c.itemId)}: {c.from ? dayName(c.from) : 'new'} → {c.to ? dayName(c.to) : 'later'}</span>
                                ))}
                                <button type="button" className="ds-button ds-button-primary self-start" disabled={busy} onClick={() => apply.mutate(plan)}>Move</button>
                              </>
                            ) : (
                              <span role="alert" className="text-destructive">{plan.preview.conflicts.map((c) => scheduleConflictMessage(c.reasonCode)).join(' ') || 'That day does not work.'}</span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </ItemCard>
                )
              })}
              {!open && day.items.length > limit && (
                <button type="button" className="text-left text-sm font-bold underline" onClick={() => setExpanded((e) => ({ ...e, [day.date]: true }))}>
                  +{day.items.length - limit} more
                </button>
              )}
              {off && day.items.length === 0 && <span className="text-sm text-muted-foreground">{day.dayOff ? 'Day off' : 'Rest day'}</span>}
            </section>
          )
        })}
      </div>
    </div>
  )
}
