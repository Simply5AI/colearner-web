'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Flame } from 'lucide-react'
import {
  buildWeekBars,
  countTopicsByState,
  downloadProgressCsv,
  downloadProgressPdf,
  getTutorProgress,
  splitTrendByBlueprint,
  TOPIC_STATE_LABEL,
  TOPIC_STATE_ORDER,
  type TutorProgressResponse,
} from '@/lib/api/tutor-loop/progress'
import { getTutorSchedule } from '@/lib/api/tutor-loop/schedule'
import { getStudyPreferences } from '@/lib/api/tutor-loop/profile'
import {
  formatReadinessBadgeText,
  formatStudyDuration,
  getTutorToday,
  resolveTutorActionHref,
} from '@/lib/api/tutor-loop/today'
import { LearnApiError } from '@/lib/api/learn-request'
import { addCalendarDays, formatTutorDate, isoWeekRange, todayCalendarDate } from '@/lib/tutor-loop/date'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import { coArt, useTutorIdentity } from '@/components/tutor-loop/today/tutor-identity'
import { todayKey } from '@/components/tutor-loop/today/today-tab'

const downloadMessage = (e: unknown) => (e instanceof Error && e.message ? e.message : 'That download could not be made. Try again.')
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const CHART_HEIGHT = 150

function Section({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) {
  return (
    <section className="ds-card flex flex-col gap-3" data-testid={testId}>
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  )
}

/** The progress route may not be live yet; fall back to what Today already knows (readiness, streak, weekly minutes, weak topics). */
function limitedFrom(today: Awaited<ReturnType<typeof getTutorToday>>): TutorProgressResponse {
  return {
    week: [],
    weeklyTargetMinutes: today.weeklyTargetMinutes,
    streakDays: today.streakDays,
    readiness: today.readiness,
    trend: [],
    topics: [],
    weakConcepts: today.weakConcepts,
  }
}

export function ProgressTab({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { workspace, tutorName, tutorIcon, adult } = useTutorIdentity()
  const options = { workspace }
  const today = useQuery({ queryKey: todayKey(workspace, null), queryFn: () => getTutorToday({}, options), retry: false })
  const progress = useQuery({ queryKey: ['tutor-progress', workspace], queryFn: () => getTutorProgress({}, options), retry: false })
  const prefs = useQuery({ queryKey: ['tutor-study-preferences', workspace], queryFn: () => getStudyPreferences(options), retry: false })
  const todayDate = today.data?.date ?? todayCalendarDate()
  const week = useMemo(() => {
    const { from } = isoWeekRange(todayDate)
    return { from, to: addCalendarDays(from, 6), dates: Array.from({ length: 7 }, (_, i) => addCalendarDays(from, i)) }
  }, [todayDate])
  const schedule = useQuery({
    queryKey: ['tutor-schedule', workspace, week.from, week.to],
    queryFn: () => getTutorSchedule({ from: week.from, to: week.to }, options),
    retry: false,
  })
  const [downloaded, setDownloaded] = useState<string | null>(null)
  const download = useMutation({
    mutationFn: (kind: 'csv' | 'pdf') => (kind === 'pdf' ? downloadProgressPdf() : downloadProgressCsv()),
    onSuccess: (result) => setDownloaded(result.fileName),
    onMutate: () => setDownloaded(null),
  })

  const routeMissing = progress.isError && progress.error instanceof LearnApiError && (progress.error.status === 404 || progress.error.status === 501)
  const data: TutorProgressResponse | null = progress.data ?? (routeMissing && today.data ? limitedFrom(today.data) : null)
  const limited = !progress.data && !!data

  if (progress.isPending || (routeMissing && today.isPending)) {
    return (
      <div role="status" data-state="loading" className="flex flex-col gap-3">
        <span className="sr-only">Loading your progress</span>
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-44 animate-pulse rounded-[var(--ds-radius,1rem)] bg-muted" />
      </div>
    )
  }
  if (!data) {
    return (
      <div role="alert" className="ds-card flex flex-col items-start gap-3" data-state="error">
        <img src={coArt(tutorIcon, 'resting')} alt="" width={64} height={64} />
        <b>Your progress could not be loaded</b>
        <p className="text-sm text-muted-foreground">{friendlyError(progress.error, 'Check your connection and try again.').message}</p>
        <button type="button" className="ds-button ds-button-primary" onClick={() => void progress.refetch()}>Try again</button>
      </div>
    )
  }

  const { readiness } = data
  const enough = !!readiness && readiness.evidence === 'ENOUGH' && readiness.percent !== null
  const examTitle = today.data?.goal?.title ?? 'your exam'
  const bars = buildWeekBars(week.dates, data.week, todayDate)
  const weekMinutes = bars.reduce((sum, b) => sum + (b.minutes ?? 0), 0)
  const dailyTarget = prefs.data?.minutesPerDay ?? null
  const maxMinutes = Math.max(dailyTarget ?? 0, ...bars.map((b) => b.minutes ?? 0), 10)
  const counts = countTopicsByState(data.topics)
  const totalTopics = data.topics.filter((t) => !t.archived).length
  const trend = data.trend.slice(-8).filter((point) => point.percent !== null)
  const runs = splitTrendByBlueprint(trend)
  const pace = schedule.data?.pace
  const emptyWeek = !limited && bars.every((b) => !b.minutes)

  return (
    <div className="flex flex-col gap-4" data-state={limited ? 'limited' : 'ready'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[length:var(--ds-h1,2rem)] font-black leading-tight tracking-tight">Progress</h1>
        <div className="flex flex-wrap items-center gap-2">
          {adult ? (
            <>
              <button type="button" className="ds-button ds-button-secondary" disabled={download.isPending} onClick={() => download.mutate('pdf')}><Download size={16} aria-hidden="true" /> Download PDF</button>
              <button type="button" className="ds-button ds-button-secondary" disabled={download.isPending} onClick={() => download.mutate('csv')}>Download CSV</button>
            </>
          ) : (
            <button type="button" className="ds-button ds-button-secondary" disabled={download.isPending} onClick={() => download.mutate('csv')}><Download size={16} aria-hidden="true" /> Download CSV</button>
          )}
        </div>
      </div>
      {download.isError && <p role="alert" className="text-sm text-destructive">{downloadMessage(download.error)}</p>}
      {downloaded && <p role="status" className="text-sm">{downloaded} downloaded.</p>}
      {limited && <p role="status" className="text-sm text-muted-foreground">Your full progress view is not available yet. Here is what we can show now.</p>}

      <section className="ds-card flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="progress-readiness">
        <div
          role="img"
          aria-label={enough ? `${readiness!.percent} percent ready` : 'Readiness not measured yet'}
          className="grid h-28 w-28 shrink-0 place-items-center rounded-full"
          style={{ background: enough ? `conic-gradient(var(--color-accent, var(--primary)) ${readiness!.percent}%, var(--color-neutral-300, #d4d4d8) 0)` : 'var(--color-neutral-300, #d4d4d8)' }}
        >
          <span className="grid h-20 w-20 place-items-center rounded-full bg-card text-center text-lg font-black leading-tight sm:text-xl">{enough ? `${readiness!.percent}%` : 'Not yet'}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="w-fit rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-border">{enough ? 'Measured' : 'Practice evidence'}</span>
          <b className="text-lg">{enough ? `Ready for ${examTitle}` : 'Not enough practice yet'}</b>
          <span className="text-sm text-muted-foreground" data-testid="readiness-line">{formatReadinessBadgeText(readiness)}</span>
          {pace && pace.state !== 'UNAVAILABLE' && (
            <span className="text-sm" data-testid="pace-line">
              {pace.state === 'ON_TRACK' ? 'On pace for your plan.' : `About ${formatStudyDuration(pace.shortfallMinutes)} behind your plan.`}
            </span>
          )}
          {runs.length > 0 && (
            <div role="img" aria-label={`Readiness over ${trend.length} measurements`} className="mt-2 flex h-24 items-end gap-2" data-testid="readiness-trend">
              {runs.map((run, i) => (
                <div key={run[0]!.date + i} className={`flex items-end gap-1.5 ${i > 0 ? 'border-l-2 border-dashed border-border pl-2' : ''}`} title={i > 0 ? 'Topic weights changed here' : undefined}>
                  {run.map((point) => (
                    <span key={point.date} className="flex w-9 flex-col items-center gap-1 text-[11px] text-muted-foreground">
                      <span
                        className="w-full rounded-t bg-[var(--color-accent-200,var(--muted))]"
                        style={{ height: `${Math.max(4, Math.round(((point.percent ?? 0) / 100) * 64))}px`, opacity: point.percent === null ? 0.3 : 1 }}
                      />
                      {formatTutorDate(point.date, { includeYear: false })}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="This week" testId="progress-week">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatStudyDuration(limited ? (today.data?.weeklyMinutes ?? 0) : weekMinutes)} of {formatStudyDuration(data.weeklyTargetMinutes)}</span>
            <span className="inline-flex items-center gap-1.5"><Flame size={14} aria-hidden="true" />{data.streakDays === 1 ? '1 day streak' : `${data.streakDays} day streak`}</span>
          </div>
          {limited ? (
            <p className="text-sm text-muted-foreground">Daily minutes will appear here soon.</p>
          ) : (
            <>
              <div role="img" aria-label="Minutes per day this week" className="relative mt-3 flex items-end gap-2" style={{ height: CHART_HEIGHT }}>
                {dailyTarget !== null && (
                  <span aria-hidden="true" className="absolute inset-x-0 border-t-2 border-dashed border-border text-[11px] text-muted-foreground" style={{ bottom: Math.round((dailyTarget / maxMinutes) * CHART_HEIGHT) }}>
                    <span className="bg-card pr-1">Goal {dailyTarget} min</span>
                  </span>
                )}
                {bars.map((bar, i) => (
                  <span
                    key={bar.date}
                    data-testid="week-bar"
                    className={`flex-1 rounded-t ${bar.future ? 'border-2 border-dashed border-border' : bar.minutes ? 'bg-primary' : 'bg-muted'}`}
                    style={{ height: bar.future ? 6 : Math.max(4, Math.round(((bar.minutes ?? 0) / maxMinutes) * CHART_HEIGHT)) }}
                    title={`${DAY_NAMES[i]}: ${bar.future ? 'Planned' : `${bar.minutes} min`}`}
                  />
                ))}
              </div>
              <div className="flex gap-2 text-center text-xs">
                {bars.map((bar, i) => (
                  <span key={bar.date} className={`flex flex-1 flex-col ${bar.date === todayDate ? 'font-bold text-primary' : ''}`}>
                    <b>{DAY_NAMES[i]}</b>
                    <span className="text-muted-foreground">{bar.future ? 'Planned' : `${bar.minutes} min`}</span>
                  </span>
                ))}
              </div>
              {emptyWeek && <p className="text-sm text-muted-foreground">No study recorded yet this week.</p>}
            </>
          )}
        </Section>

        <Section title="Topics" testId="progress-topics">
          {totalTopics === 0 ? (
            <p className="text-sm text-muted-foreground">{limited ? 'Topic progress will appear here soon.' : 'Add a plan to see how your topics are going.'}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {TOPIC_STATE_ORDER.map((state) => (
                <li key={state} className="flex items-center gap-3">
                  <span className="min-w-28 text-sm">{TOPIC_STATE_LABEL[state]}</span>
                  <b>{counts[state]}</b>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Needs practice" testId="progress-weak">
          {data.weakConcepts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing needs extra practice right now.</p>
          ) : (
            <ul className="flex flex-col">
              {data.weakConcepts.map((w) => (
                <li key={w.conceptId} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
                  <b className="flex-1 [overflow-wrap:anywhere]">{w.label}</b>
                  <Link href={resolveTutorActionHref({ kind: 'PRACTICE', targetId: w.topicId }, today.data?.goal?.id ?? null)} className="ds-button ds-button-secondary" aria-label={`Practise ${w.label}`}>Practise</Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Your schedule" testId="progress-schedule">
          <p className="text-sm">
            {pace?.state === 'BEHIND'
              ? `You are about ${formatStudyDuration(pace.shortfallMinutes)} behind. ${tutorName} can help you spread the work out.`
              : pace?.state === 'ON_TRACK'
                ? 'Your plan fits the time you have.'
                : 'See what is planned for this week.'}
          </p>
          <button type="button" className="ds-button ds-button-secondary self-start" onClick={onOpenSchedule}>Update my schedule</button>
        </Section>
      </div>
    </div>
  )
}
