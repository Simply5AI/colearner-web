'use client'
import { useState } from 'react'
import { CoCharacter, AgeBandScope, type AgeBand } from '@/components/design-system'

const previews: { band: AgeBand; label: string; title: string; description: string; note: string }[] = [
  { band: 'kids', label: 'Ages 6–9', title: 'Let’s discover together!', description: 'One small idea, a friendly picture, and a guided next step.', note: 'Large controls, simple language and grown-up guidance.' },
  { band: 'tweens', label: 'Ages 10–13', title: 'Wonder. Try. Understand.', description: 'Explore a concept, try a question, and use a hint when you need one.', note: 'Clear explanations and space to build independence.' },
  { band: 'teens', label: 'Ages 14–17', title: 'Build your understanding.', description: 'Connect topics, practice recall, and plan what to review next.', note: 'Focused study with school and family learning controls.' },
  { band: 'adults', label: 'Adult learners', title: 'Read deeply. Keep what matters.', description: 'A future track for research, grounded questions and spaced review.', note: 'Retained design direction; school learners come first.' },
]
export function AgePreviews() {
  const [selected, setSelected] = useState(0)
  const preview = previews[selected]!
  function selectBand(event: React.MouseEvent<HTMLButtonElement>) { setSelected(Number(event.currentTarget.dataset.index)) }
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2" role="group" aria-label="Choose an age design preview">{previews.map((item, index) => <button key={item.band} data-index={index} type="button" aria-pressed={selected === index} aria-controls="age-preview" onClick={selectBand} className={`min-h-12 rounded-full border px-5 font-semibold ${selected === index ? 'border-primary bg-primary text-primary-foreground' : 'bg-card'}`}>{item.label}</button>)}</div>
    <AgeBandScope band={preview.band} className="rounded-[2rem] bg-muted p-6 sm:p-8">
      <div id="age-preview" className="flex min-h-64 flex-col items-center gap-6 sm:flex-row" aria-live="polite">
        <div className="flex w-44 shrink-0 justify-center"><CoCharacter band={preview.band} state="curious" size={preview.band === 'adults' ? 32 : 160} decorative /></div>
        <div className="max-w-2xl rounded-[1.5rem] bg-card p-6"><p className="mb-3 text-sm font-semibold text-muted-foreground">Design preview · {preview.label}</p><h3 className="font-[family-name:var(--font-display)] text-2xl font-extrabold sm:text-3xl">{preview.title}</h3><p className="mt-3">{preview.description}</p><p className="mt-4 text-sm text-muted-foreground">{preview.note}</p></div>
      </div>
    </AgeBandScope>
  </div>
}
