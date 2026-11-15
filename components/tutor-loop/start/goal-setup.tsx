'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, ChevronLeft, GraduationCap, Lightbulb, School } from 'lucide-react'
import {
  createGoal, getGoal, listAvailableMaterials, updateExam, updateGoal,
  type LearnerGoalItem, type LearnerGoalKind, type TutorPlan,
} from '@/lib/api/tutor-loop/goals'
import {
  applySchedulePreview, getStudyPreferences, getTutorProfile, previewStudyPreferences,
  STUDY_MINUTE_PRESETS, TUTOR_ICONS, TUTOR_STYLES, updateTutorProfile, validateTutorName,
  type TutorIcon, type TutorStyle,
} from '@/lib/api/tutor-loop/profile'
import { diffCalendarDays, todayCalendarDate } from '@/lib/tutor-loop/date'
import { friendlyError } from './errors'
import { PlanStage } from './plan-draft'
import { TutorArt, TutorStartFrame } from './start-frame'

type Workspace = 'school' | 'personal'

const goalKinds = [
  { value: 'EXAM', label: 'An exam', Icon: GraduationCap },
  { value: 'LEARNING', label: 'Learn something', Icon: Lightbulb },
  { value: 'SCHOOL', label: 'Keep up with school', Icon: School },
] as const

const questions = {
  1: 'What are you working towards?',
  3: 'How much time a day?',
  4: 'What will you learn from?',
  5: 'Last thing: make me yours.',
} as const

const option = (on: boolean) => `rounded-[var(--ds-radius)] border-2 p-[14px] text-start font-bold ${on ? 'border-primary bg-[var(--co-surface)]' : 'border-border bg-card'}`

/** Best effort: study time has no write endpoint until the schedule API ships, so a failure never blocks the learner. */
async function rememberStudyTime(minutes: number, workspace: Workspace) {
  try {
    const options = { workspace }
    const current = await getStudyPreferences(options)
    if (current.minutesPerDay === minutes) return
    const preview = await previewStudyPreferences({ revision: current.revision, minutesPerDay: minutes }, options)
    if (preview.canApply) await applySchedulePreview(preview.id, { clientRequestId: crypto.randomUUID(), baseRevision: preview.baseRevision }, options)
  } catch {
    /* kept out of the way on purpose */
  }
}

export function GoalSetup({ adult, icon, workspace, requestId, entryUrl }: {
  adult: boolean; icon: string; workspace: Workspace; requestId: string; entryUrl: string
}) {
  const router = useRouter()
  const options = { workspace }
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<LearnerGoalKind>('EXAM')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [passMark, setPassMark] = useState('')
  const [minutes, setMinutes] = useState<number>(STUDY_MINUTE_PRESETS[1])
  const [materials, setMaterials] = useState<string[]>([])
  const [syllabus, setSyllabus] = useState('')
  const [tutorIcon, setTutorIcon] = useState<TutorIcon>(() => (TUTOR_ICONS.some((item) => item.value === icon) ? (icon as TutorIcon) : 'SPROUT'))
  const [tutorName, setTutorName] = useState('')
  const [style, setStyle] = useState<TutorStyle>('FRIENDLY')
  const [goal, setGoal] = useState<LearnerGoalItem | null>(null)
  const [planning, setPlanning] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const goalRequest = useRef({ id: requestId, body: '' })

  const name = validateTutorName(tutorName.trim() || null)
  const shownIcon = tutorIcon
  const shownName = tutorName.trim() && name.valid ? name.normalized : 'Co'

  const saveGoal = useMutation({
    mutationFn: async () => {
      const examDate = date || null
      const mark = adult && kind === 'EXAM' && passMark !== '' ? Number(passMark) : null
      if (goal) {
        let current = goal
        if (title.trim() !== goal.title) current = await updateGoal(goal.id, { revision: goal.revision, title: title.trim() }, options)
        if (goal.exam && (examDate !== goal.exam.date || (adult && mark !== goal.exam.passMarkPercent))) {
          await updateExam(goal.exam.id, { revision: goal.exam.revision, date: examDate, ...(adult ? { passMarkPercent: mark } : {}) }, options)
          current = await getGoal(goal.id, options)
        }
        return current
      }
      const body = JSON.stringify([kind, title.trim(), examDate, mark])
      if (goalRequest.current.body && goalRequest.current.body !== body) goalRequest.current.id = crypto.randomUUID()
      goalRequest.current.body = body
      return createGoal({
        clientRequestId: goalRequest.current.id, title: title.trim(), kind,
        ...(kind === 'EXAM' ? { exam: { date: examDate, passMarkPercent: mark } } : {}),
      }, options)
    },
    onSuccess: (saved) => { setGoal(saved); setStep(3) },
  })

  const materialQuery = useQuery({
    queryKey: ['tutor-start-materials', workspace],
    queryFn: () => listAvailableMaterials({ ...options, useFixtureFallback: false }),
    enabled: step === 4,
    retry: false,
    staleTime: 30_000,
  })

  const saveTutor = useMutation({
    mutationFn: async () => {
      const chosenName = tutorName.trim() ? name.normalized : null
      const changed = chosenName !== null || style !== 'FRIENDLY' || shownIcon !== icon
      if (changed) {
        const profile = await getTutorProfile(options)
        await updateTutorProfile({ revision: profile.revision, icon: shownIcon, style, ...(chosenName ? { name: chosenName } : {}) }, options)
      }
    },
    onSuccess: () => setPlanning(true),
  })
  const quickStart = useMutation({
    mutationFn: async () => { await rememberStudyTime(minutes, workspace) },
    onSettled: () => router.push(adult ? '/workspaces' : '/learn/home'),
  })

  const validateDetails = () => {
    if (!title.trim()) return kind === 'EXAM' ? 'Enter the name of your exam.' : 'Enter what you want to learn.'
    if (date && date < todayCalendarDate()) return 'Choose a date that has not passed.'
    if (adult && kind === 'EXAM' && passMark !== '' && !(Number(passMark) >= 0 && Number(passMark) <= 100)) return 'Pass mark must be between 0 and 100.'
    return null
  }
  const next = () => {
    if (step === 2) {
      const problem = validateDetails()
      setFieldError(problem)
      if (!problem) saveGoal.mutate()
    } else if (step === 5) {
      if (tutorName.trim() && !name.valid) { setFieldError(name.error ?? 'Try a different name'); return }
      setFieldError(null)
      saveTutor.mutate()
    } else setStep(step + 1)
  }
  const done = (_plan: TutorPlan) => quickStart.mutate()

  const goalError = saveGoal.error ? friendlyError(saveGoal.error, 'Your goal could not be saved. Try again. Your entries are still here.').message : null
  const tutorError = saveTutor.error ? friendlyError(saveTutor.error, 'Your tutor could not be saved. Try again. Your choices are still here.').message : null
  const examDays = date ? diffCalendarDays(date, todayCalendarDate()) : null
  const reaction = {
    1: kind === 'EXAM' ? 'An exam. Let’s get you ready.' : 'Nice. Let’s set a target.',
    2: examDays !== null && examDays >= 0 ? `${examDays} ${examDays === 1 ? 'day' : 'days'} to go.` : '',
    3: `${minutes} min a day. Good.`,
    4: 'I’ll build your plan from these.',
    5: 'You can change this any time in Me.',
  }[step as 1 | 2 | 3 | 4 | 5]

  if (planning && goal) {
    return (
      <TutorStartFrame adult={adult} close={entryUrl}>
        <main className="mx-auto w-full max-w-[640px] flex-1 px-5 pb-20 pt-9">
          <PlanStage
            goal={goal} workspace={workspace} icon={shownIcon} tutorName={shownName}
            materialIds={materials.length ? materials : undefined} syllabusText={syllabus}
            onAccepted={done}
            onSkip={() => quickStart.mutate()}
          />
          {quickStart.isPending && <p role="status" className="mt-4 text-muted-foreground">Opening your space…</p>}
        </main>
      </TutorStartFrame>
    )
  }

  const heading = step === 2 ? (kind === 'EXAM' ? 'Which exam, and when?' : 'What would you like to learn?') : questions[step as 1 | 3 | 4 | 5]
  const busy = saveGoal.isPending || saveTutor.isPending
  return (
    <TutorStartFrame adult={adult} step={step} close={entryUrl}>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-[22px] px-5 pb-20 pt-9">
        <div className="flex items-start gap-3.5">
          <TutorArt icon={shownIcon} size={64} state="speaking" />
          <h1 data-step-heading tabIndex={-1} className="rounded-[24px] rounded-ss-md bg-[var(--co-surface)] px-5 py-4 text-[length:var(--ds-h2)] font-extrabold leading-tight">{heading}</h1>
        </div>

        {step === 1 && (
          <div role="group" aria-label="Goal type" className="grid gap-3 sm:grid-cols-3">
            {goalKinds.filter(({ value }) => !adult || value !== 'SCHOOL').map(({ value, label, Icon }) => (
              <button key={value} type="button" aria-pressed={value === kind} disabled={goal !== null && value !== kind} onClick={() => setKind(value)}
                className={`flex min-h-20 flex-col items-start gap-2 rounded-[var(--ds-radius)] border-2 p-[18px] text-start font-bold ${value === kind ? 'border-primary bg-[var(--co-surface)]' : 'border-border bg-card'}`}>
                <Icon aria-hidden size={22} />{label}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <label className="ds-field">
              <strong>{kind === 'EXAM' ? 'Exam' : 'Goal'}</strong>
              <input className="ds-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} autoFocus aria-invalid={fieldError ? true : undefined} />
            </label>
            {kind === 'EXAM' && (
              <label className="ds-field">
                <strong>Date <span className="font-normal text-muted-foreground">(optional)</span></strong>
                <input className="ds-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            )}
            {adult && kind === 'EXAM' && (
              <label className="ds-field">
                <strong>Pass mark (%) <span className="font-normal text-muted-foreground">(optional)</span></strong>
                <input className="ds-input" type="number" min={0} max={100} step=".01" value={passMark} onChange={(event) => setPassMark(event.target.value)} />
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <strong id="minutes-label">Minutes a day</strong>
            <div role="radiogroup" aria-labelledby="minutes-label" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STUDY_MINUTE_PRESETS.map((preset) => (
                <button key={preset} type="button" role="radio" aria-checked={minutes === preset} onClick={() => setMinutes(preset)} className={option(minutes === preset)}>{preset} min</button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            {materialQuery.isPending && <p role="status" className="text-muted-foreground">Looking at your library…</p>}
            {materialQuery.data && materialQuery.data.length === 0 && <p className="text-muted-foreground">Your library is empty. You can add material any time and Co will fold it into your plan.</p>}
            {materialQuery.isError && <p className="text-muted-foreground">We could not open your library. You can carry on and add material later.</p>}
            {materialQuery.data?.map((material) => {
              const on = materials.includes(material.id)
              return (
                <button key={material.id} type="button" aria-pressed={on} onClick={() => setMaterials((old) => (on ? old.filter((id) => id !== material.id) : [...old, material.id]))} className={`flex items-center justify-between gap-3 ${option(on)}`}>
                  <span>{material.title}</span>{on && <Check aria-hidden size={18} />}
                </button>
              )
            })}
            <label className="ds-field">
              <strong>Paste your syllabus or topics <span className="font-normal text-muted-foreground">(optional)</span></strong>
              <textarea className="ds-input" rows={4} maxLength={8000} value={syllabus} onChange={(event) => setSyllabus(event.target.value)} />
            </label>
            <button type="button" className="ds-button ds-button-ghost self-start text-primary" onClick={() => setStep(5)}>Add my own later</button>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <div role="radiogroup" aria-label="Tutor icon" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TUTOR_ICONS.map((item) => (
                <button key={item.value} type="button" role="radio" aria-checked={tutorIcon === item.value} onClick={() => setTutorIcon(item.value)} className={`flex flex-col items-center gap-1 ${option(tutorIcon === item.value)}`}>
                  <img src={item.src} alt="" width={56} height={56} /><span>{item.label}</span>
                </button>
              ))}
            </div>
            <label className="ds-field">
              <strong>Name</strong>
              <input className="ds-input" value={tutorName} placeholder="Co" maxLength={16} onChange={(event) => setTutorName(event.target.value)} aria-invalid={tutorName.trim() && !name.valid ? true : undefined} />
            </label>
            <div role="radiogroup" aria-label="Style" className="grid gap-3 sm:grid-cols-2">
              {TUTOR_STYLES.map((item) => (
                <button key={item.value} type="button" role="radio" aria-checked={style === item.value} onClick={() => setStyle(item.value)} className={option(style === item.value)}>
                  <span className="block">{item.label}</span>
                  <span className="block text-sm font-normal text-muted-foreground">{item.subtitle}</span>
                </button>
              ))}
            </div>
            <button type="button" className="ds-button ds-button-ghost self-start text-primary" onClick={() => { setTutorName(''); setStyle('FRIENDLY'); setTutorIcon(TUTOR_ICONS.some((item) => item.value === icon) ? (icon as TutorIcon) : 'SPROUT'); setFieldError(null); setPlanning(true) }}>Skip — use Co</button>
          </div>
        )}

        {reaction && <p className="text-muted-foreground" aria-live="polite">{reaction}</p>}
        {(fieldError || goalError || tutorError) && <p role="alert" className="text-destructive">{fieldError ?? goalError ?? tutorError}</p>}
        {step >= 3 && goal && (
          <button type="button" className="self-start text-sm font-bold text-primary underline" disabled={quickStart.isPending} onClick={() => quickStart.mutate()}>
            Skip the rest · start learning now
          </button>
        )}
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="ds-button ds-button-ghost" style={{ visibility: step > 1 ? 'visible' : 'hidden' }} onClick={() => { setFieldError(null); setStep(step - 1) }} disabled={busy}>
            <ChevronLeft aria-hidden size={18} />Back
          </button>
          <button type="button" className="ds-button ds-button-primary" onClick={next} disabled={busy}>
            {busy ? 'Saving…' : step === 5 ? 'Make my plan' : 'Next'}
          </button>
        </div>
      </main>
    </TutorStartFrame>
  )
}
