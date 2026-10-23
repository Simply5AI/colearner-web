'use client'
import { useState } from 'react'
import { CoCharacter, type AgeBand } from '@/components/design-system'
import styles from './landing.module.css'

const previews: { band: AgeBand; label: string; title: string; description: string; note: string }[] = [
  { band: 'kids', label: 'Ages 6–9', title: 'Let’s discover together!', description: 'One small idea, a friendly explanation, and a guided next step.', note: 'Large controls, simple language and grown-up guidance.' },
  { band: 'tweens', label: 'Ages 10–13', title: 'Wonder. Try. Understand.', description: 'Explore a concept, try a question, and use a hint when you need one.', note: 'Clear explanations and space to build independence.' },
  { band: 'teens', label: 'Ages 14–17', title: 'Build your understanding.', description: 'Connect topics, practice recall, and plan what to review next.', note: 'Focused study with school and family learning controls.' },
  { band: 'adults', label: 'Adult learners', title: 'Read deeply. Keep what matters.', description: 'A future track for research, grounded questions and spaced review.', note: 'A future learning track. The current rollout focuses on schools.' },
]
export function AgePreviews() {
  const [selected, setSelected] = useState(0)
  const preview = previews[selected]!
  function selectBand(event: React.MouseEvent<HTMLButtonElement>) { setSelected(Number(event.currentTarget.dataset.index)) }
  return <div>
    <div className={styles.ageChoices} role="group" aria-label="Choose an age design preview">{previews.map((item, index) => <button key={item.band} data-index={index} type="button" aria-pressed={selected === index} aria-controls="age-preview" onClick={selectBand}>{item.label}</button>)}</div>
    <div id="age-preview" className={styles.agePreview} aria-live="polite">
      <div className={styles.ageArtwork}><CoCharacter band={preview.band} state="curious" size={preview.band === 'adults' ? 80 : 150} decorative /></div>
      <div><p className={styles.ageCaption}>Design preview · {preview.label}</p><h3>{preview.title}</h3><p>{preview.description}</p><p className={styles.ageNote}>{preview.note}</p></div>
    </div>
  </div>
}
