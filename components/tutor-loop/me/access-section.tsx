'use client'

import { speakTutorText, type TutorProfile, type TutorTextScale } from '@/lib/api/tutor-loop/profile'
import { friendlyError } from '@/components/tutor-loop/start/errors'
import { Switch } from './tutor-section'
import { useProfilePatch, type MeWorkspace } from './use-profile'

const sizes: { value: TutorTextScale; label: string }[] = [
  { value: 'NORMAL', label: 'Normal text size' },
  { value: 'LARGE', label: 'Large text size' },
  { value: 'EXTRA_LARGE', label: 'Extra large text size' },
]

export function AccessSection({ workspace, profile }: { workspace: MeWorkspace; profile: TutorProfile }) {
  const patch = useProfilePatch(workspace)
  const acc = profile.accessibility
  const change = (next: Partial<typeof acc>) => patch.mutate({ accessibility: next })
  const toggles = [
    { key: 'easyRead', label: 'Easy-read font', sub: 'A font made for easy reading' },
    { key: 'reducedMotion', label: 'Less movement', sub: 'Turn off animations' },
    { key: 'readAloud', label: `Read ${profile.name} aloud`, sub: `${profile.name}’s messages are spoken` },
  ] as const
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <strong id="text-size">Text size</strong>
        <div role="radiogroup" aria-labelledby="text-size" className="flex gap-3">
          {sizes.map((size, index) => (
            <button key={size.value} type="button" role="radio" aria-checked={acc.textScale === size.value} aria-label={size.label} onClick={() => change({ textScale: size.value })}
              className={`min-h-12 min-w-14 rounded-[var(--ds-radius)] border-2 font-bold ${acc.textScale === size.value ? 'border-primary bg-[var(--co-surface)]' : 'border-border'}`}
              style={{ fontSize: 14 + index * 4 }}>Aa</button>
          ))}
        </div>
        <span className="text-muted-foreground">This is how text will look.</span>
      </div>
      {toggles.map((item) => (
        <div key={item.key} className="flex items-center justify-between gap-4">
          <span><b className="block">{item.label}</b><span className="text-sm text-muted-foreground">{item.sub}</span></span>
          <Switch label={item.label} on={acc[item.key]} disabled={patch.isPending} onChange={(next) => change({ [item.key]: next })} />
        </div>
      ))}
      {acc.readAloud && (
        <button type="button" className="ds-button ds-button-secondary self-start"
          onClick={() => speakTutorText(`This is how ${profile.name} sounds when reading aloud.`)}>Hear a sample</button>
      )}
      {patch.isError && <p role="alert" className="text-destructive">{friendlyError(patch.error, 'That could not be saved. Try again.').message}</p>}
    </div>
  )
}
