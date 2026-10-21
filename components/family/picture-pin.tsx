'use client'
import { useState } from 'react'
import { Star, Moon, Sun, TreeDeciduous, Fish, Rocket, Flower2, Apple, Cloud, Volume2 } from 'lucide-react'
import { Button } from '@/components/design-system'
const pictures = [{ label:'Star', Icon:Star }, { label:'Moon', Icon:Moon }, { label:'Sun', Icon:Sun }, { label:'Tree', Icon:TreeDeciduous }, { label:'Fish', Icon:Fish }, { label:'Rocket', Icon:Rocket }, { label:'Flower', Icon:Flower2 }, { label:'Apple', Icon:Apple }, { label:'Cloud', Icon:Cloud }]
export function PicturePin({ value, onChange, disabled = false, label = 'Tap your 3 secret pictures!' }: { value: number[]; onChange: (pictures: number[]) => void; disabled?: boolean; label?: string }) {
  const [speechError, setSpeechError] = useState('')
  const read = () => {
    // Explicit device speech only; never cloud inference, microphone capture or PIN reading.
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') { setSpeechError('Read-aloud is unavailable on this device. The instructions are shown below.'); return }
    const voices = window.speechSynthesis.getVoices().filter(voice => voice.localService)
    if (!voices.length) { setSpeechError('No offline voice is available on this device. You can follow the written instructions.'); return }
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance('Tap your three secret pictures, in order. Ask your grown-up for help if you forget.')
    speech.voice = voices.find(voice => voice.lang.startsWith('en')) ?? voices[0] ?? null
    window.speechSynthesis.speak(speech)
    setSpeechError('')
  }
  return <fieldset disabled={disabled} className="mx-auto w-full max-w-md space-y-5"><legend className="mb-3 text-xl font-bold">{label}</legend><Button variant="secondary" onClick={read}><Volume2 size={20} aria-hidden="true" />Read instructions aloud</Button><p className="text-sm text-muted-foreground">Choose three pictures in order. You can repeat a picture.</p><div role="status" aria-label={`${value.length} of 3 pictures selected`} className="flex justify-center gap-4">{[0,1,2].map(n => <span key={n} aria-hidden="true" className={`size-6 rounded-full border-2 border-primary ${n < value.length ? 'bg-primary' : 'bg-background'}`} />)}</div><div className="grid grid-cols-3 gap-3">{pictures.map(({label: name, Icon},i) => <button type="button" key={name} aria-label={name} disabled={value.length === 3 || disabled} onClick={() => onChange([...value,i])} className="flex aspect-square min-h-16 items-center justify-center rounded-3xl border bg-accent/40 text-primary shadow-sm focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"><Icon size={44} aria-hidden="true" /></button>)}</div><Button variant="ghost" disabled={!value.length || disabled} onClick={() => onChange([])}>Start pictures again</Button>{speechError && <p role="status" className="text-sm">{speechError}</p>}</fieldset>
}
