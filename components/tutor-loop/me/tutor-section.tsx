'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import {
  getStyleSampleAnswer, setNudgeMute, TUTOR_ICONS, TUTOR_NUDGE_KINDS, TUTOR_STYLES, validateTutorName,
  type TutorProfile, type TutorStyle,
} from '@/lib/api/tutor-loop/profile'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import { useProfilePatch, type MeWorkspace } from './use-profile'

const Switch = ({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
    className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors motion-reduce:transition-none ${on ? 'border-primary bg-primary' : 'border-border bg-muted'}`}>
    <span className={`size-5 rounded-full bg-background transition-transform motion-reduce:transition-none ${on ? 'translate-x-6 rtl:-translate-x-6' : 'translate-x-0.5 rtl:-translate-x-0.5'}`} />
  </button>
)
export { Switch }

export function TutorSection({ workspace, profile, adult }: { workspace: MeWorkspace; profile: TutorProfile; adult: boolean }) {
  const patch = useProfilePatch(workspace)
  const [name, setName] = useState(profile.name === 'Co' ? '' : profile.name)
  const [nameProblem, setNameProblem] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [muted, setMuted] = useState<Record<string, boolean>>({})
  const mute = useMutation({ mutationFn: ({ kind, value }: { kind: (typeof TUTOR_NUDGE_KINDS)[number]['kind']; value: boolean }) => setNudgeMute(kind, value, { workspace }),
    onSuccess: (result) => setMuted((old) => ({ ...old, [result.kind]: result.muted })) })
  const sample = getStyleSampleAnswer(profile.style, adult ? '18+' : '14-17')
  const saveName = () => {
    const check = validateTutorName(name.trim() || null)
    if (!check.valid) return setNameProblem(check.error ?? 'Try a different name')
    setNameProblem(null)
    patch.mutate({ name: name.trim() ? check.normalized : null })
  }
  const style = TUTOR_STYLES.find((item) => item.value === profile.style)
  const error = patch.error ? friendlyError(patch.error, 'That could not be saved. Try again.').message : null
  return (
    <div className="flex flex-col gap-6">
      <section className="flex items-center gap-4 rounded-[var(--ds-radius)] bg-[var(--co-surface)] p-4" aria-label="Preview">
        <img src={`/tutor-loop/${profile.icon.toLowerCase()}-speaking.svg`} alt="" width={64} height={64} />
        <div>
          <span className="text-sm font-bold uppercase text-muted-foreground">Preview</span>
          <p className="font-bold" data-testid="style-sample">“{sample}”</p>
          <span className="text-sm text-muted-foreground">{profile.name} · {style?.label}</span>
        </div>
      </section>
      <div className="flex flex-col gap-2">
        <label className="ds-field">
          <strong>Your tutor’s name</strong>
          <span className="flex gap-2">
            <input className="ds-input" value={name} placeholder="Co" maxLength={16} aria-invalid={nameProblem ? true : undefined} onChange={(event) => { setName(event.target.value); setNameProblem(null) }} />
            <button type="button" className="ds-button ds-button-secondary" disabled={patch.isPending} onClick={saveName}>Save name</button>
          </span>
        </label>
        {nameProblem && <span role="alert" className="text-destructive">{nameProblem}</span>}
        <span className="text-sm text-muted-foreground">{adult ? 'Up to 16 characters. Shown everywhere you ask your tutor.' : 'Keep it friendly. Your school and parent can see this name.'}</span>
      </div>
      <div className="flex flex-col gap-2">
        <strong id="tutor-icon">Pick an icon</strong>
        <div role="radiogroup" aria-labelledby="tutor-icon" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TUTOR_ICONS.map((item) => (
            <button key={item.value} type="button" role="radio" aria-checked={profile.icon === item.value} onClick={() => patch.mutate({ icon: item.value })}
              className={`flex flex-col items-center gap-1 rounded-[var(--ds-radius)] border-2 p-3 font-bold ${profile.icon === item.value ? 'border-primary bg-[var(--co-surface)]' : 'border-border'}`}>
              <img src={item.src} alt="" width={48} height={48} />{item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <strong id="tutor-style">Style</strong>
        <div role="radiogroup" aria-labelledby="tutor-style" className="grid gap-3 sm:grid-cols-2">
          {TUTOR_STYLES.map((item) => (
            <button key={item.value} type="button" role="radio" aria-checked={profile.style === item.value} onClick={() => patch.mutate({ style: item.value as TutorStyle })}
              className={`rounded-[var(--ds-radius)] border-2 p-3 text-start ${profile.style === item.value ? 'border-primary bg-[var(--co-surface)]' : 'border-border'}`}>
              <b className="block">{item.label}</b><span className="block text-sm text-muted-foreground">{item.subtitle}</span>
              <span className="mt-1 block text-sm">“{adult ? item.adultSample : item.teenSample}”</span>
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Whatever the style, your tutor always explains its reasons, never gives away homework answers, and never pressures you.</span>
      </div>
      <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className="flex items-center justify-between rounded-[var(--ds-radius)] border border-border p-3 font-bold">
        More settings <ChevronDown aria-hidden size={18} className={more ? 'rotate-180' : ''} />
      </button>
      {more && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <strong>How {profile.name} shows up</strong>
            <div className="flex flex-wrap gap-2">
              {([['AVAILABLE', 'Show my tutor'], ['QUIET', 'Keep it quiet']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={profile.presence === value} onClick={() => patch.mutate({ presence: value })}
                  className={`min-h-11 rounded-full border-2 px-4 font-bold ${profile.presence === value ? 'border-primary bg-[var(--co-surface)]' : 'border-border'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3"><strong>{profile.name} speaks first</strong><Switch label="Tutor speaks first" on={profile.nudgesEnabled} onChange={(next) => patch.mutate({ nudgesEnabled: next })} /></div>
            {profile.nudgesEnabled && TUTOR_NUDGE_KINDS.map((item) => (
              <div key={item.kind} className="flex items-center justify-between gap-3">
                <span>{item.label}</span>
                <Switch label={item.label} on={!(muted[item.kind] ?? false)} disabled={mute.isPending} onChange={(next) => mute.mutate({ kind: item.kind, value: !next })} />
              </div>
            ))}
            {mute.isError && <p role="alert" className="text-destructive">{friendlyError(mute.error, 'That could not be saved. Try again.').message}</p>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span><b className="block">Answers not from your material</b><span className="text-sm text-muted-foreground">{adult ? `${profile.name} marks these “Not from your material”` : 'Your school decides this'}</span></span>
            {adult
              ? <Switch label="Answers not from your material" on={!profile.generalOptOut} onChange={(next) => patch.mutate({ generalOptOut: !next })} />
              : <span className="text-sm font-bold">{profile.generalOptOut ? 'Off' : 'On'}</span>}
          </div>
        </div>
      )}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  )
}
