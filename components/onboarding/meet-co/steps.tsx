'use client'

import { useState, type ReactNode } from 'react'
import { BookOpen, Calculator, Camera, FlaskConical, Globe, Languages, Leaf, Link2, Palette, Sparkles, Upload, X } from 'lucide-react'
import { Button, CoCharacter, EmptyState, Input, LoadingState, ReadAloudText, Select, Toggle } from '@/components/design-system'
import { customSubjectPattern, examDateToInput, examDateToApi, maxCustomSubjects, maxGoalLength, type OnboardingBand, type OnboardingDraft, type OnboardingState } from '@/lib/api/onboarding'
import { coThemes, firstImportOptions, hello, kidsLines, settingsNote, stepTitles, themeOf } from './copy'
import { useReadAloud } from './use-read-aloud'

export interface StepProps {
  band: OnboardingBand
  state: OnboardingState
  draft: OnboardingDraft
  patch: (change: Partial<OnboardingDraft>) => void
  learnerName: string | null
  errors: Partial<Record<keyof OnboardingDraft, string>>
}

const iconFor = (name: string) => {
  const key = name.toLowerCase()
  if (/social|geo|histor|civic|world/.test(key)) return Globe
  if (/sci|chem|phys|bio/.test(key)) return FlaskConical
  if (/math|arith|number/.test(key)) return Calculator
  if (/hindi|lang|english|sanskrit/.test(key)) return Languages
  if (/art|draw|music/.test(key)) return Palette
  if (/nature|environment|evs/.test(key)) return Leaf
  return BookOpen
}

/** One sentence per control so a non-reader can hear each line on its own. */
function KidsLine({ line, large = false }: { line: string; large?: boolean }) {
  const read = useReadAloud(line)
  return <ReadAloudText words={read.words} activeWordIndex={read.activeWordIndex} canReadAloud={read.canReadAloud} onReadAloud={read.onReadAloud} label={`Read aloud: ${line}`} className={large ? 'text-[length:var(--ds-h2)] font-extrabold [&_p]:leading-tight' : 'text-[length:var(--ds-h3)] font-bold'} />
}
function StepHeading({ band, step, lines, title, description }: { band: OnboardingBand; step: keyof (typeof stepTitles)['kids']; lines?: readonly string[]; title?: string; description?: ReactNode }) {
  if (band === 'kids') {
    return <div className="space-y-3">
      <h1 data-step-heading tabIndex={-1} className="sr-only">{stepTitles.kids[step]}</h1>
      {(lines ?? []).map((line, index) => <KidsLine key={line} line={line} large={index === 0} />)}
    </div>
  }
  return <div className="space-y-2">
    <h1 data-step-heading tabIndex={-1} className="font-[family-name:var(--font-display)] font-extrabold outline-none">{title ?? stepTitles[band][step]}</h1>
    {description && <p className="max-w-prose text-muted-foreground">{description}</p>}
  </div>
}
const Note = ({ band }: { band: OnboardingBand }) => band === 'teens' ? <p className="text-sm text-muted-foreground">{settingsNote}</p> : null

function Tile({ type = 'checkbox', name, label, checked, onChange, disabled, icon: Icon, big = false, description }: { type?: 'checkbox' | 'radio'; name: string; label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; icon?: typeof BookOpen; big?: boolean; description?: string }) {
  return <label data-selected={checked} className={`flex min-w-0 cursor-pointer gap-3 rounded-[var(--radius)] border-2 bg-card p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-70 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring motion-reduce:transition-none ${big ? 'flex-col items-center justify-center py-6 text-center' : 'items-center'} ${checked ? 'border-primary' : 'border-input'}`}>
    <input className="sr-only" type={type} name={name} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    {Icon && <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-muted ${big ? 'size-20' : 'size-10'}`}><Icon size={big ? 40 : 20} /></span>}
    <span className="min-w-0 break-words font-bold">{label}{description && <span className="block text-[length:var(--ds-small)] font-normal text-muted-foreground">{description}</span>}</span>
  </label>
}

export function HelloStep({ band, learnerName }: Pick<StepProps, 'band' | 'learnerName'>) {
  return <div className="flex flex-col items-center gap-6 text-center">
    <CoCharacter band={band} state="waving" size={band === 'kids' ? 220 : band === 'tweens' ? 160 : 120} label="Co waving hello" />
    {band === 'kids'
      ? <StepHeading band={band} step="HELLO" lines={kidsLines.hello(learnerName)} />
      : <StepHeading band={band} step="HELLO" title={hello(band, learnerName)} description="Three quick questions, then bring your first thing to learn." />}
  </div>
}

function SchoolValues({ state, band }: { state: OnboardingState; band: OnboardingBand }) {
  if (!state.preload) return null
  const { board, grade, className } = state.preload
  return <div className="rounded-[var(--radius)] border border-border bg-muted p-4" data-testid="school-values">
    <p className="font-bold">{band === 'kids' ? 'Set by your grown-up' : 'Set by your school'}</p>
    <p>{board} · {className ?? `Class ${grade}`}</p>
  </div>
}

export function ContextStep({ band, state }: Pick<StepProps, 'band' | 'state'>) {
  if (band === 'kids') {
    return <div className="flex flex-wrap items-center justify-center gap-8">
      <CoCharacter band="kids" state="curious" size={200} label="Co looking curious" />
      <div className="max-w-md"><StepHeading band={band} step="CONTEXT" lines={kidsLines.context(state.preload?.grade ?? state.draft.grade)} /></div>
    </div>
  }
  return <div className="space-y-6">
    <StepHeading band={band} step="CONTEXT" description="Co is set up for school learning right now." />
    <div className="grid gap-4 sm:grid-cols-2">
      <Tile name="context" label="School" description="Classes, homework and exams" checked disabled onChange={() => undefined} icon={BookOpen} />
    </div>
    <p className="text-sm text-muted-foreground">University, learning just for you and research are not available yet.</p>
    <SchoolValues state={state} band={band} />
    <Note band={band} />
  </div>
}

function CustomSubjects({ draft, patch, error }: { draft: OnboardingDraft; patch: StepProps['patch']; error?: string }) {
  const [value, setValue] = useState('')
  const [problem, setProblem] = useState('')
  const add = () => {
    const next = value.trim().replace(/\s+/g, ' ')
    if (!next) return
    if (!customSubjectPattern.test(next)) { setProblem('Use 2 to 40 letters, numbers or spaces.'); return }
    if (draft.customSubjects.some(item => item.toLowerCase() === next.toLowerCase())) { setProblem('You already added that one.'); return }
    if (draft.customSubjects.length >= maxCustomSubjects) { setProblem(`You can add up to ${maxCustomSubjects} of your own.`); return }
    patch({ customSubjects: [...draft.customSubjects, next] }); setValue(''); setProblem('')
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1"><Input label="Add a subject of your own" value={value} maxLength={40} error={problem || error} onChange={event => { setValue(event.target.value); setProblem('') }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} /></div>
      <Button variant="secondary" onClick={add} disabled={!value.trim()}>Add subject</Button>
    </div>
    {draft.customSubjects.length > 0 && <ul aria-label="Your own subjects" className="flex flex-wrap gap-2">
      {draft.customSubjects.map(item => <li key={item} className="inline-flex items-center gap-1 rounded-full border border-border bg-card ps-3"><span>{item}</span><Button variant="ghost" aria-label={`Remove ${item}`} className="!min-w-0 !p-2" onClick={() => patch({ customSubjects: draft.customSubjects.filter(other => other !== item) })}><X size={16} aria-hidden="true" /></Button></li>)}
    </ul>}
  </div>
}

export function SubjectsStep({ band, state, draft, patch, errors, curriculumBusy, onCurriculumChange }: StepProps & { curriculumBusy: boolean; onCurriculumChange: (change: Pick<Partial<OnboardingDraft>, 'board' | 'grade'>) => void }) {
  const editable = !state.preload && band !== 'kids'
  const subjects = state.curriculumSubjects
  const toggle = (subjectId: string, on: boolean) => patch({ subjectIds: on ? [...draft.subjectIds, subjectId] : draft.subjectIds.filter(item => item !== subjectId) })
  const suggestions = state.goalSuggestions.status === 'AVAILABLE' ? state.goalSuggestions.items : []
  return <div className="space-y-6">
    {band === 'kids'
      ? <StepHeading band={band} step="SUBJECTS" lines={subjects.length ? kidsLines.subjects : kidsLines.noSubjects} />
      : <StepHeading band={band} step="SUBJECTS" description={band === 'tweens' ? 'Pick any that you like.' : undefined} />}
    <SchoolValues state={state} band={band} />
    {editable && <fieldset className="space-y-3" disabled={curriculumBusy}>
      <legend className="font-bold">Board and class</legend>
      <div role="radiogroup" aria-label="Board" className="flex flex-wrap gap-2">
        {(['CBSE', 'ICSE'] as const).map(board => <label key={board} className={`inline-flex cursor-pointer items-center rounded-full border-2 px-5 font-semibold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${draft.board === board ? 'border-primary bg-secondary' : 'border-input bg-card'}`} style={{ minHeight: 'var(--ds-target)' }}><input className="sr-only" type="radio" name="board" checked={draft.board === board} onChange={() => onCurriculumChange({ board })} />{board}</label>)}
      </div>
      <div className="max-w-xs"><Select label="Class" value={draft.grade ?? ''} onChange={event => onCurriculumChange({ grade: event.target.value ? Number(event.target.value) : null })}><option value="">Choose your class</option>{Array.from({ length: 10 }, (_, index) => index + 1).map(grade => <option key={grade} value={grade}>Class {grade}</option>)}</Select></div>
      {curriculumBusy && <LoadingState label="Finding your subjects…" />}
    </fieldset>}
    {subjects.length > 0
      ? <fieldset className="space-y-3">
          <legend className="sr-only">Subjects</legend>
          <div className={`grid gap-4 ${band === 'kids' ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
            {subjects.map(subject => <Tile key={subject.subjectId} name="subject" label={subject.name} icon={iconFor(subject.name)} big={band === 'kids'} checked={draft.subjectIds.includes(subject.subjectId)} onChange={on => toggle(subject.subjectId, on)} />)}
          </div>
        </fieldset>
      : !curriculumBusy && (band === 'kids'
          ? <EmptyState band="kids" title="No subjects yet" description="Ask your grown-up to help." />
          : <EmptyState band={band} title={editable ? 'Choose a board and class' : 'No subjects are set up for your class yet'} description={editable ? 'Your subjects will appear here. You can also add your own below.' : 'You can add your own subjects below and change them later.'} />)}
    {band !== 'kids' && <CustomSubjects draft={draft} patch={patch} error={errors.customSubjects} />}
    {band === 'teens' && <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Input label="Your goal (optional)" value={draft.goal ?? ''} maxLength={maxGoalLength} hint={suggestions.length ? undefined : 'For example: score well in my exams.'} error={errors.goal} onChange={event => patch({ goal: event.target.value || null })} />
        {suggestions.length > 0 && <div className="space-y-2" data-testid="goal-suggestions">
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles size={14} aria-hidden="true" />Suggested by Co (AI). These are ideas, not your plan.</p>
          <ul className="flex flex-wrap gap-2">{suggestions.map(item => <li key={item.text}><Button variant="secondary" aria-pressed={draft.goal === item.text} onClick={() => patch({ goal: item.text })}>{item.text}</Button></li>)}</ul>
        </div>}
      </div>
      <Input label="Exam date (optional)" type="date" value={examDateToInput(draft.examDate)} error={errors.examDate} onChange={event => patch({ examDate: examDateToApi(event.target.value) })} />
    </div>}
    <Note band={band} />
  </div>
}

export function PersonaliseStep({ band, draft, patch, errors }: StepProps) {
  if (band === 'teens') {
    return <div className="space-y-6">
      <StepHeading band={band} step="PERSONALISE" />
      <div className="flex flex-wrap items-center gap-6">
        <CoCharacter band="teens" state={draft.coPresence === 'MINIMAL' ? 'idle' : 'curious'} size={draft.coPresence === 'MINIMAL' ? 32 : 96} label="Co preview" />
        <fieldset className="space-y-2">
          <legend className="font-bold">Co presence</legend>
          <div role="radiogroup" aria-label="Co presence" className="flex flex-wrap gap-2">
            {([['AVATAR', 'Avatar'], ['MINIMAL', 'Minimal']] as const).map(([value, label]) => <label key={value} className={`inline-flex cursor-pointer items-center rounded-full border-2 px-5 font-semibold has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring ${draft.coPresence === value ? 'border-primary bg-secondary' : 'border-input bg-card'}`} style={{ minHeight: 'var(--ds-target)' }}><input className="sr-only" type="radio" name="presence" checked={draft.coPresence === value} onChange={() => patch({ coPresence: value })} />{label}</label>)}
          </div>
        </fieldset>
      </div>
      <div className="max-w-sm space-y-1">
        <Toggle label="Co voice" checked={draft.voiceEnabled === true} onCheckedChange={checked => patch({ voiceEnabled: checked })} />
        <p className="text-sm text-muted-foreground">Saves your choice for when voice is available.</p>
      </div>
      <Note band={band} />
    </div>
  }
  const theme = themeOf(draft.coTheme)
  const nickname = draft.coNickname?.trim()
  return <div className="space-y-6">
    {band === 'kids' ? <StepHeading band={band} step="PERSONALISE" lines={kidsLines.personalise} /> : <StepHeading band={band} step="PERSONALISE" description="Choose Co’s colour and, if you like, a nickname." />}
    <div className="flex flex-wrap items-center gap-8">
      <div style={{ filter: theme.filter }} data-testid="co-preview" data-co-theme={theme.key}><CoCharacter band={band} state="idle" size={band === 'kids' ? 180 : 130} label={`Co in ${theme.label}`} /></div>
      <div className="min-w-0 flex-1 space-y-5">
        <fieldset className="space-y-3">
          <legend className="sr-only">Co colour</legend>
          <div role="radiogroup" aria-label="Co colour" className="flex flex-wrap gap-4">
            {coThemes.map(item => <label key={item.key} title={item.label} className={`relative flex size-16 cursor-pointer items-center justify-center rounded-full has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring ${theme.key === item.key ? 'ring-4 ring-foreground ring-offset-4 ring-offset-background' : ''}`} style={{ background: item.swatch }}>
              <input className="sr-only" type="radio" name="co-theme" checked={theme.key === item.key && draft.coTheme === item.key} onChange={() => patch({ coTheme: item.key })} aria-label={item.label} />
            </label>)}
          </div>
        </fieldset>
        <Input label={band === 'kids' ? 'What should I call myself?' : 'Co’s nickname (optional)'} value={draft.coNickname ?? ''} maxLength={20} error={errors.coNickname} hint={nickname ? undefined : 'Co is a good name too.'} onChange={event => patch({ coNickname: event.target.value || null })} />
        <p className="rounded-[var(--radius)] border border-border bg-card p-3">Hi, I’m {nickname || 'Co'}!</p>
      </div>
    </div>
  </div>
}

const optionIcon = { camera: Camera, upload: Upload, link: Link2 }
export function FirstImportStep({ band, busy, onChoose }: { band: OnboardingBand; busy: boolean; onChoose: (href: string | null) => void }) {
  const options = firstImportOptions[band]
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center gap-6">
      <CoCharacter band={band} state="curious" size={band === 'kids' ? 200 : band === 'tweens' ? 140 : 100} label="Co looking curious" />
      <div className="min-w-0 flex-1"><StepHeading band={band} step="FIRST_IMPORT" lines={kidsLines.firstImport} /></div>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {options.map((option, index) => {
        const Icon = optionIcon[option.icon]
        return <a key={option.key} href={option.href} aria-disabled={busy || undefined} onClick={event => { event.preventDefault(); if (!busy) onChoose(option.href) }} className={`ds-button ${index === 0 ? 'ds-button-primary' : 'ds-button-secondary'} ${band === 'kids' ? 'w-full text-[length:var(--ds-h3)]' : ''}`}><Icon size={22} aria-hidden="true" />{option.label}</a>
      })}
      <Button variant="ghost" disabled={busy} onClick={() => onChoose(null)}>Later</Button>
    </div>
    {band !== 'kids' && <p className="text-sm text-muted-foreground">The import page shows which sources your school allows.</p>}
  </div>
}
