'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * Browser speech for kids' read-aloud. Nothing autoplays and no text leaves the device
 * through this hook; where the browser has no speech engine the control stays disabled.
 */
export function useReadAloud(text: string) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const [supported, setSupported] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const utterance = useRef<SpeechSynthesisUtterance | null>(null)
  useEffect(() => { setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) }, [])
  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    utterance.current = null
    setActive(null)
  }, [])
  useEffect(() => stop, [text, stop])
  const speak = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    const next = new SpeechSynthesisUtterance(text)
    next.lang = document.documentElement.lang || 'en'
    next.rate = 0.85
    next.onboundary = event => {
      if (event.name && event.name !== 'word') return
      let offset = 0
      for (let index = 0; index < words.length; index++) {
        const length = words[index]!.length
        if (event.charIndex <= offset + length) { setActive(index); return }
        offset += length + 1
      }
    }
    next.onend = () => setActive(null)
    next.onerror = () => setActive(null)
    utterance.current = next
    window.speechSynthesis.speak(next)
  }, [supported, text, words])
  return { words, canReadAloud: supported, onReadAloud: speak, activeWordIndex: active }
}
