'use client'

import { createContext, Fragment, useContext, type ReactNode } from 'react'

/*
 * Word highlighting for the read-aloud of a question. The speech hook, the voice choice and the control are the lesson's
 * (`useLocalReadAloud`, `ReadAloudControl`: local voices only, never autoplay). Only the rendering of the highlighted word
 * is here: words are plain text separated by real spaces and only the spoken word is wrapped, so the text keeps its natural
 * accessible name and reads as one sentence.
 */
interface SpeechValue { active: number | null; starts: Record<string, number> }
const SpeechContext = createContext<SpeechValue | null>(null)
export function SpeechProvider({ active, starts, children }: SpeechValue & { children: ReactNode }) {
  return <SpeechContext.Provider value={{ active, starts }}>{children}</SpeechContext.Provider>
}

/** One spoken segment. The word being spoken is marked; no animation is used for the mark. */
export function Spoken({ id, text, className }: { id: string; text: string; className?: string }) {
  const speech = useContext(SpeechContext)
  const start = speech?.starts[id]
  const words = text.split(/\s+/).filter(Boolean)
  if (!speech || start === undefined || speech.active === null || speech.active < start || speech.active >= start + words.length) return <span className={className} data-spoken={start === undefined ? undefined : id}>{words.join(' ')}</span>
  const active = speech.active - start
  return <span className={className} data-spoken={id}>{words.map((word, index) => <Fragment key={index}>{index > 0 && ' '}{index === active
    ? <mark aria-current="true" className="rounded-sm bg-secondary px-0.5 text-secondary-foreground outline outline-2 outline-primary">{word}</mark>
    : word}</Fragment>)}</span>
}
