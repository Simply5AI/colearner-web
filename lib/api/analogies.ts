import { z } from 'zod'
import { LearnApiError, LearnSessionError, learnErrorMessage } from './learn-request'

/*
 * DEMO-C "Explain it with an analogy" (pack 0.1.8). Contract: agents/contracts/DEMO-student-contracts.md, section C.
 * `POST /api/learn/co/analogies` is ONE synchronous AI call through the same-origin learner BFF, so it has its own,
 * longer timeout (the shared learn request gives up after 30 s). The answer is READY with the card, or a friendly FAILED
 * with `{ code, retryable }`. The UI never shows raw model or error text: the card is parsed with a strict schema and a
 * failure maps to fixed copy by code.
 */
export const analogyApiBands = ['6-9', '10-13', '14-17'] as const
export type AnalogyApiBand = (typeof analogyApiBands)[number]
export const ANALOGY_TIMEOUT_MS = 90_000

export interface AnalogyMapping { part: string; mapsTo: string }
export interface AnalogyCard {
  title: string
  analogy: string
  howItMaps: AnalogyMapping[]
  whereItBreaks: string
  sourceQuote: string
  sourceAnchorRef: string
}
export type AnalogyOutcome =
  | { status: 'READY'; analogy: AnalogyCard; conceptRef: string | null }
  | { status: 'FAILED'; code: string; retryable: boolean }
export interface AnalogyRequest { materialId: string; conceptRef: string; conceptLabel: string; ageBand?: AnalogyApiBand; requestId?: string }

const card = z.object({
  title: z.string().min(1),
  analogy: z.string().min(1),
  howItMaps: z.array(z.object({ part: z.string().min(1), mapsTo: z.string().min(1) }).strict()).max(5),
  whereItBreaks: z.string().min(1),
  sourceQuote: z.string().min(1),
  sourceAnchorRef: z.string().min(1),
}).strict()
const outcome = z.discriminatedUnion('status', [
  z.object({ status: z.literal('READY'), analogy: card, conceptRef: z.string().nullish().transform(value => value ?? null) }).passthrough()
    .transform(({ status, analogy, conceptRef }) => ({ status, analogy, conceptRef })),
  z.object({ status: z.literal('FAILED'), code: z.string().min(1).max(64), retryable: z.boolean() }).passthrough()
    .transform(({ status, code, retryable }) => ({ status, code, retryable })),
])

/** Fixed copy per closed failure code. Server text is never shown. */
export const analogyFailureCopy: Record<string, string> = {
  insufficient_source: 'Co could not find enough about this idea in your material to make an analogy.',
  age_band_unsupported: 'Co can not make an analogy for this idea yet.',
  unsafe_content: 'Co can not make an analogy for this idea.',
  authorization_changed: 'Your access to this material changed. Open it again from your library.',
  invalid_output: 'Co could not make a good analogy this time. Try again.',
  timeout: 'Co took too long. Try again.',
  processor_unavailable: 'Co is resting for a moment. Try again soon.',
}
export const analogyFallbackCopy = 'Co could not make an analogy right now. Try again.'
export const analogyFailureMessage = (code: string): string => analogyFailureCopy[code] ?? analogyFallbackCopy

export const analogiesApi = {
  /** Resolves with READY or FAILED; rejects (LearnApiError / LearnSessionError) only for a request the server refused. */
  create: async (input: AnalogyRequest, signal?: AbortSignal): Promise<AnalogyOutcome> => {
    let response: Response
    try {
      response = await fetch('/api/learn/co/analogies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(ANALOGY_TIMEOUT_MS)]) : AbortSignal.timeout(ANALOGY_TIMEOUT_MS),
      })
    } catch { return { status: 'FAILED', code: 'timeout', retryable: true } }
    if (response.status === 401) throw new LearnSessionError('Your learning session has ended. Check learner access to continue.')
    const body: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const code = body && typeof body === 'object' && typeof (body as Record<string, unknown>).code === 'string' ? (body as Record<string, string>).code : undefined
      throw new LearnApiError(response.status, learnErrorMessage(response.status, code && /^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? code : undefined, body), code)
    }
    const data = body !== null && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body
    const parsed = outcome.safeParse(data)
    if (!parsed.success) return { status: 'FAILED', code: 'invalid_output', retryable: true }
    return parsed.data
  },
}

/** The text saved to "My pages": the analogy, how it maps, where it breaks and the words from the material. */
export function analogyNoteBody(value: AnalogyCard): string {
  const maps = value.howItMaps.map(row => `- ${row.part} is like ${row.mapsTo}`).join('\n')
  return [value.analogy, `How it matches:\n${maps}`, `Where it breaks: ${value.whereItBreaks}`, `From your material: "${value.sourceQuote}"`].join('\n\n')
}
