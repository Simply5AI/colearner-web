'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { applySchedulePreview, getStudyPreferences, previewStudyPreferences, STUDY_MINUTE_PRESETS, WEEKDAY_PILLS } from '@/lib/api/tutor-loop/profile'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import type { MeWorkspace } from './use-profile'

export function weeklyLabel(days: number, minutes: number) {
  const total = days * minutes
  const hours = Math.floor(total / 60)
  const rest = total % 60
  return `About ${hours ? `${hours} h ` : ''}${rest ? `${rest} min ` : ''}a week.`.replace('  ', ' ')
}

export function TimeSection({ workspace, tutorName }: { workspace: MeWorkspace; tutorName: string }) {
  const options = { workspace }
  const prefs = useQuery({ queryKey: ['tutor-study-preferences', workspace], queryFn: () => getStudyPreferences(options), retry: false })
  const [days, setDays] = useState<number[]>([])
  const [minutes, setMinutes] = useState<number>(40)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (prefs.data) { setDays(prefs.data.studyDays); setMinutes(prefs.data.minutesPerDay) }
  }, [prefs.data])
  const save = useMutation({
    mutationFn: async () => {
      const current = prefs.data!
      const preview = await previewStudyPreferences({ revision: current.revision, studyDays: days, minutesPerDay: minutes }, options)
      if (!preview.canApply) throw Object.assign(new Error('SCHEDULE_FULL'), { status: 409, code: 'SCHEDULE_FULL' })
      await applySchedulePreview(preview.id, { clientRequestId: crypto.randomUUID(), baseRevision: preview.baseRevision }, options)
      return preview
    },
    onSuccess: () => { setSaved(true); void prefs.refetch() },
  })
  if (prefs.isPending) return <p role="status" className="text-muted-foreground">Loading your study time…</p>
  if (prefs.isError) return <p role="alert" className="text-muted-foreground">Study time is not available yet. Your plan still works. <button type="button" className="underline" onClick={() => void prefs.refetch()}>Try again</button></p>
  const toggle = (day: number) => { setSaved(false); setDays((old) => (old.includes(day) ? old.filter((item) => item !== day) : [...old, day].sort())) }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <strong id="study-days">Study days</strong>
        <div role="group" aria-labelledby="study-days" className="flex flex-wrap gap-2">
          {WEEKDAY_PILLS.map((pill) => (
            <button key={pill.day} type="button" aria-pressed={days.includes(pill.day)} aria-label={pill.fullLabel} onClick={() => toggle(pill.day)}
              className={`min-h-11 rounded-full border-2 px-4 font-bold ${days.includes(pill.day) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{pill.shortLabel}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <strong id="study-minutes">Minutes a day</strong>
        <div role="radiogroup" aria-labelledby="study-minutes" className="flex flex-wrap gap-2">
          {STUDY_MINUTE_PRESETS.map((preset) => (
            <button key={preset} type="button" role="radio" aria-checked={minutes === preset} onClick={() => { setSaved(false); setMinutes(preset) }}
              className={`min-h-11 rounded-full border-2 px-4 font-bold ${minutes === preset ? 'border-primary bg-[var(--co-surface)]' : 'border-border'}`}>{preset} min</button>
          ))}
        </div>
      </div>
      <p className="text-muted-foreground">{days.length ? `${weeklyLabel(days.length, minutes)} ${tutorName} will update your schedule.` : 'Pick at least one study day.'}</p>
      {save.isError && <p role="alert" className="text-destructive">{friendlyError(save.error, 'Your study time could not be saved. Try again.').message}</p>}
      {saved && <p role="status">Saved. Your schedule is updating.</p>}
      <button type="button" className="ds-button ds-button-primary self-start" disabled={days.length === 0 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save study time'}</button>
    </div>
  )
}
