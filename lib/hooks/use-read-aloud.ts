'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
export { useReadAloud as useBasicReadAloud } from '@/components/onboarding/meet-co/use-read-aloud'

/**
 * B08 on-device read-aloud for lessons.
 *
 * Why this is not just the onboarding hook: that hook speaks with the browser's default voice, and some
 * browsers default to a network voice that sends the text to a server. The B08 contract is "local voices
 * only, no text leaves the device, nothing autoplays", so this hook only offers read-aloud when the
 * browser exposes a local (`localService`) voice for the page language, and only ever speaks with it.
 * With no such voice, or no speech engine, `canReadAloud` stays false and callers must hide the control.
 * The onboarding hook is re-exported above as `useBasicReadAloud` and is not edited.
 */
export interface LocalReadAloud {
  words: string[]
  canReadAloud: boolean
  speaking: boolean
  /** Index of the word being spoken (from word-boundary events), or null. */
  activeWordIndex: number | null
  onReadAloud: () => void
  onStop: () => void
}

const hasEngine = () => typeof window !== 'undefined' && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'

/** Word tokens exactly as the speech text is split, so a highlight index always maps back to rendered words. */
export const speechWords = (text: string) => text.split(/\s+/).filter(Boolean)

/** Chooses a local voice for the language, preferring an exact language match. Returns null when none is local. */
export function pickLocalVoice(voices: readonly SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const local = voices.filter(voice => voice.localService)
  const base = lang.toLowerCase().split('-')[0] ?? 'en'
  return local.find(voice => voice.lang.toLowerCase() === lang.toLowerCase())
    ?? local.find(voice => voice.lang.toLowerCase().split(/[-_]/)[0] === base)
    ?? null
}

export function useLocalReadAloud(text: string, options: { rate?: number } = {}): LocalReadAloud {
  const words = useMemo(() => speechWords(text), [text])
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [active, setActive] = useState<number | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const rate = options.rate ?? 1
  const current = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    if (!hasEngine()) { setVoice(null); return }
    const synth = window.speechSynthesis
    const lang = document.documentElement.lang || 'en'
    const refresh = () => setVoice(pickLocalVoice(synth.getVoices(), lang))
    refresh()
    synth.addEventListener?.('voiceschanged', refresh)
    return () => synth.removeEventListener?.('voiceschanged', refresh)
  }, [])

  const stop = useCallback(() => {
    if (hasEngine()) window.speechSynthesis.cancel()
    current.current = null
    setActive(null); setSpeaking(false)
  }, [])
  // Stops whenever the text changes (step change) and on unmount, so speech never carries over.
  useEffect(() => stop, [text, stop])

  const speak = useCallback(() => {
    if (!voice || !hasEngine() || words.length === 0) return
    window.speechSynthesis.cancel()
    const utterance = new window.SpeechSynthesisUtterance(words.join(' '))
    utterance.voice = voice
    utterance.lang = voice.lang
    utterance.rate = rate
    // The spoken text is the words joined by single spaces, so charIndex maps straight onto the token list.
    utterance.onboundary = event => {
      if (event.name && event.name !== 'word') return
      let offset = 0
      for (let index = 0; index < words.length; index++) {
        const length = words[index]!.length
        if (event.charIndex <= offset + length) { setActive(index); return }
        offset += length + 1
      }
    }
    const done = () => { if (current.current === utterance) { current.current = null; setActive(null); setSpeaking(false) } }
    utterance.onend = done
    utterance.onerror = done
    current.current = utterance
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }, [voice, words, rate])

  return { words, canReadAloud: voice !== null, speaking, activeWordIndex: active, onReadAloud: speak, onStop: stop }
}
