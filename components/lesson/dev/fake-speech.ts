/*
 * A fake browser speech engine for tests and /dev/lesson. It exposes one local voice, records what was spoken, and
 * can either replay word-boundary events on a timer (the dev harness) or let a test fire them by hand.
 */
export interface FakeSpeech {
  spoken: string[]
  cancelled: number
  /** The utterance currently speaking, if any. */
  current: () => SpeechSynthesisUtterance | null
  /** Fires a word boundary at a character offset, as a real engine would. */
  boundary: (charIndex: number) => void
  finish: () => void
  restore: () => void
}

interface FakeOptions { autoplayMs?: number | null; voices?: Partial<SpeechSynthesisVoice>[] }
/** The speech globals are replaced wholesale, so they are handled as plain properties. */
type Target = Record<string, unknown>

const keys = ['speechSynthesis', 'SpeechSynthesisUtterance'] as const
/** Real browsers expose these as accessors on window, so they are replaced with defineProperty and restored from their descriptors. */
function takeover(target: Target, values: Record<(typeof keys)[number], unknown>) {
  const saved = keys.map(key => [key, Object.getOwnPropertyDescriptor(target, key)] as const)
  for (const key of keys) Object.defineProperty(target, key, { configurable: true, writable: true, value: values[key] })
  return () => { for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(target, key, descriptor); else delete target[key] } }
}

export function installFakeSpeech(options: FakeOptions = {}): FakeSpeech {
  const target = globalThis as unknown as Target
  const voices = (options.voices ?? [{ name: 'Fixture local voice', lang: 'en-US', localService: true }]) as SpeechSynthesisVoice[]
  const listeners = new Set<() => void>()
  let undo: () => void = () => undefined
  let current: (SpeechSynthesisUtterance & { _timer?: ReturnType<typeof setInterval> }) | null = null
  const result: FakeSpeech = {
    spoken: [], cancelled: 0,
    current: () => current,
    boundary: charIndex => { current?.onboundary?.({ name: 'word', charIndex } as SpeechSynthesisEvent) },
    finish: () => { const done = current; if (done?._timer) clearInterval(done._timer); current = null; done?.onend?.({} as SpeechSynthesisEvent) },
    restore: () => undo(),
  }
  class FakeUtterance {
    text: string; voice: SpeechSynthesisVoice | null = null; lang = ''; rate = 1
    onboundary: ((event: SpeechSynthesisEvent) => void) | null = null
    onend: ((event: SpeechSynthesisEvent) => void) | null = null
    onerror: ((event: SpeechSynthesisEvent) => void) | null = null
    constructor(text: string) { this.text = text }
  }
  const synth = {
    getVoices: () => voices,
    addEventListener: (_: string, listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_: string, listener: () => void) => { listeners.delete(listener) },
    speak: (utterance: SpeechSynthesisUtterance) => {
      current = utterance as typeof current
      result.spoken.push(utterance.text)
      if (options.autoplayMs) {
        const offsets: number[] = []
        utterance.text.split(' ').reduce((offset, word) => { offsets.push(offset); return offset + word.length + 1 }, 0)
        let index = 0
        const timer = setInterval(() => {
          if (current !== utterance) { clearInterval(timer); return }
          if (index >= offsets.length) { clearInterval(timer); result.finish(); return }
          result.boundary(offsets[index]!); index += 1
        }, options.autoplayMs)
        ;(utterance as { _timer?: ReturnType<typeof setInterval> })._timer = timer
      }
    },
    cancel: () => {
      result.cancelled += 1
      const done = current as { _timer?: ReturnType<typeof setInterval> } | null
      if (done?._timer) clearInterval(done._timer)
      current = null
    },
  }
  undo = takeover(target, { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance })
  return result
}

/** Removes any speech engine, as on a browser that has none. */
export function removeSpeech(): () => void {
  return takeover(globalThis as unknown as Target, { speechSynthesis: undefined, SpeechSynthesisUtterance: undefined })
}
