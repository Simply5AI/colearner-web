import { describe, expect, it } from 'vitest'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import {
  announcementFor, coErrorMessage, coPoseFor, failureMessage, GROUNDING_FOOTER, isUnconfirmed, MAX_SUGGESTIONS, mergeTurns, messageLimit, parentVisibilityNote, pendingLabel,
  phaseOf, problemFor, replyView,
} from '@/components/co/co-model'
import type { CoReply, CoTurnView } from '@/components/co/co-types'
import { beyondReply, clarifyReply, coBands, guidanceText, safetyReply, sourcedReply, topics, turnFixture, wordLimit } from '@/components/co/dev/co-fixtures'

const base = (): CoReply => ({ ...sourcedReply('teens', 'EXAM') })
const words = (sentence: string) => sentence.trim().split(/\s+/).filter(Boolean).length
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter(Boolean)

describe('F-L8-04 reply rendering rules', () => {
  it('shows "Beyond your material" only when the server says the reply goes beyond it', () => {
    expect(replyView({ ...base(), beyondMaterial: false, beyondNote: null }).beyond).toBe(false)
    const beyond = replyView({ ...base(), beyondMaterial: true, beyondNote: 'Not in your material.', sources: [] })
    expect(beyond).toMatchObject({ beyond: true, beyondNote: 'Not in your material.' })
    // A note without the flag is never shown (the strict schema refuses it as well; this is the defence in depth).
    expect(replyView({ ...base(), beyondMaterial: false, beyondNote: 'Sneaky note.' })).toMatchObject({ beyond: false, beyondNote: null })
  })
  it('keeps sources unique, suggestions to three, key points to four', () => {
    const source = base().sources[0]!
    const view = replyView({
      ...base(), sources: [source, { ...source }, { ...source, label: 'page 9', anchorRef: 'anchor-p9' }],
      suggestions: ['One?', 'one?', 'Two?', 'Three?', 'Four?', ' '], keyPoints: ['a', 'b', 'c', 'd', 'e'],
    })
    expect(view.sources.map(item => item.label)).toEqual([source.label, 'page 9'])
    expect(view.suggestions).toEqual(['One?', 'Two?', 'Three?'])
    expect(view.suggestions.length).toBeLessThanOrEqual(MAX_SUGGESTIONS)
    expect(view.keyPoints).toEqual(['a', 'b', 'c', 'd'])
  })
  it('renders no key points when none were returned', () => {
    expect(replyView({ ...base(), keyPoints: null }).keyPoints).toEqual([])
    expect(replyView(sourcedReply('teens', 'SIMPLE')).keyPoints).toEqual([])
  })
  it.each(coBands)('shows a safety redirect as the code-owned guidance verbatim and nothing else (%s)', band => {
    for (const kind of ['SAFE_REDIRECT', 'TRUSTED_ADULT'] as const) {
      const reply = safetyReply(band, kind)
      const view = replyView(reply)
      expect(view.kind).toBe('safety')
      expect(view.text).toBe(guidanceText[band][kind])
      expect(view).toMatchObject({ beyond: false, beyondNote: null, sources: [], suggestions: [], keyPoints: [], origin: 'CODE' })
    }
  })
  it('never shows model text, sources or beyond tags on a redirect, even if the payload carried them', () => {
    const view = replyView({
      ...base(), disposition: 'SAFE_REDIRECT', beyondMaterial: true, beyondNote: 'Model note.', text: 'Model words that must not show.',
      safety: { redirected: true, reasonCodes: ['OFF_TOPIC_UNSAFE'], guidance: '  Exact guidance, untouched.  ' },
    })
    expect(view.text).toBe('  Exact guidance, untouched.  ')
    expect(view).toMatchObject({ kind: 'safety', beyond: false, sources: [], suggestions: [], keyPoints: [] })
    // A redirect flag with no separate guidance falls back to the server's code-owned text.
    expect(replyView({ ...safetyReply('kids'), safety: { redirected: true, reasonCodes: [], guidance: null } }).text).toBe(guidanceText.kids.SAFE_REDIRECT)
    // The flag alone marks a redirect, whatever the disposition says.
    expect(replyView({ ...base(), safety: { redirected: true, reasonCodes: ['OTHER'], guidance: 'Ask a grown-up.' } }).kind).toBe('safety')
  })
  it('treats clarify as an ordinary answer without sources', () => {
    const view = replyView(clarifyReply('tweens'))
    expect(view).toMatchObject({ kind: 'answer', beyond: false, sources: [], origin: 'AI' })
  })
})

describe('copy by band', () => {
  it('chooses the parent-visibility note by band and mode', () => {
    expect(parentVisibilityNote('kids', 'FULL')).toBe('Your grown-up can see your chats with Co.')
    expect(parentVisibilityNote('tweens', 'FULL')).toBe('Your parent can see your chats with Co.')
    expect(parentVisibilityNote('teens', 'SUMMARY')).toBe('Your parent can see a summary of your chats with Co and any safety alerts.')
    expect(parentVisibilityNote('kids', 'SUMMARY')).toMatch(/summary/)
    expect(parentVisibilityNote('tweens', 'SUMMARY')).toMatch(/summary/)
  })
  it('says what Co is doing, kids and others differently, and has the grounding footer', () => {
    expect(pendingLabel('kids')).toBe('Co is thinking')
    expect(pendingLabel('tweens')).toBe('Co is checking your material')
    expect(pendingLabel('teens')).toBe('Co is checking your material')
    expect(GROUNDING_FOOTER).toBe('Co answers from your material and labels anything beyond it.')
  })
  it('limits a message by band', () => {
    expect(messageLimit).toEqual({ kids: 300, tweens: 500, teens: 1000 })
  })
  it('never uses the listening pose: there is no microphone', () => {
    const poses = (['idle', 'sending', 'pending', 'answered', 'redirected', 'failed'] as const).map(coPoseFor)
    expect(poses).not.toContain('listening')
    expect(coPoseFor('pending')).toBe('thinking')
  })
})

describe('turn phases and announcements', () => {
  const turn = (over: Partial<CoTurnView>): CoTurnView => turnFixture({ id: 't1', ordinal: 1, learnerText: 'Q', ...over })
  it('derives the phase of the chat', () => {
    expect(phaseOf([], false)).toBe('idle')
    expect(phaseOf([], true)).toBe('sending')
    expect(phaseOf([turn({ status: 'QUEUED' })], false)).toBe('pending')
    expect(phaseOf([turn({ status: 'RUNNING' })], false)).toBe('pending')
    expect(phaseOf([turn({ status: 'FAILED', failure: { code: 'x', retryable: true } })], false)).toBe('failed')
    expect(phaseOf([turn({ reply: sourcedReply('kids') })], false)).toBe('answered')
    expect(phaseOf([turn({ reply: safetyReply('kids') })], false)).toBe('redirected')
  })
  it('announces working, finished, failed and stopped turns, never partial text', () => {
    expect(announcementFor(turn({ status: 'QUEUED' }), 'kids')).toBe('Co is thinking')
    expect(announcementFor(turn({ status: 'RUNNING' }), 'teens')).toBe('Co is checking your material')
    expect(announcementFor(turn({ reply: sourcedReply('kids') }), 'kids')).toBe(`Co answered. ${topics.kids.answer}`)
    expect(announcementFor(turn({ reply: safetyReply('tweens') }), 'tweens')).toBe(`Safety check. ${guidanceText.tweens.SAFE_REDIRECT}`)
    expect(announcementFor(turn({ status: 'FAILED', failure: { code: 'x', retryable: true } }), 'teens')).toMatch(/could not answer/)
    expect(announcementFor(turn({ status: 'CANCELLED' }), 'teens')).toMatch(/stopped/)
    expect(announcementFor(undefined, 'teens')).toBe('')
  })
  it('merges turns by id and orders them by ordinal', () => {
    const a = turn({ id: 'a', ordinal: 1 }), b = turn({ id: 'b', ordinal: 2, status: 'RUNNING' })
    const merged = mergeTurns([b, a], [{ ...b, status: 'READY', reply: sourcedReply('kids') }])
    expect(merged.map(item => item.id)).toEqual(['a', 'b'])
    expect(merged[1]!.status).toBe('READY')
  })
})

describe('errors and states', () => {
  const error = (status: number, code: string, message = 'safe text') => new LearnApiError(status, message, code)
  it('maps typed Co failures to calm states', () => {
    expect(problemFor(error(403, 'CO_DISABLED_BY_POLICY'))).toMatchObject({ kind: 'policy', title: 'Not right now' })
    expect(problemFor(error(409, 'CO_UNAVAILABLE'))).toMatchObject({ kind: 'unavailable' })
    expect(problemFor(error(409, 'CONTEXT_NOT_READY'))).toMatchObject({ kind: 'not-ready', retryable: true })
    expect(problemFor(error(429, 'TURN_LIMIT_REACHED'))).toMatchObject({ kind: 'limit' })
    expect(problemFor(error(404, 'CONTEXT_NOT_FOUND'))).toMatchObject({ kind: 'denied' })
    expect(problemFor(error(403, 'SOMETHING'))).toMatchObject({ kind: 'denied' })
    expect(problemFor(error(503, 'X'))).toMatchObject({ kind: 'error', retryable: true })
  })
  it('treats an ended session as its own state, never as an adult sign-out', () => {
    const problem = problemFor(new LearnSessionError('Your learning session has ended.'))
    expect(problem).toMatchObject({ kind: 'ended', retryable: false })
    expect(new LearnSessionError('x')).not.toBeInstanceOf(LearnApiError)
  })
  it('shows server text only for POLICY_BLOCKED', () => {
    expect(coErrorMessage(error(403, 'POLICY_BLOCKED', 'Paused until tomorrow.'))).toBe('Paused until tomorrow.')
    expect(coErrorMessage(error(409, 'TURN_PENDING', 'raw server text'))).toMatch(/still answering/)
    expect(coErrorMessage(error(400, 'MESSAGE_INVALID', 'raw server text'))).not.toContain('raw server text')
  })
  it('knows which failures leave a send unconfirmed', () => {
    expect(isUnconfirmed(error(503, 'X'))).toBe(true)
    expect(isUnconfirmed(error(502, 'X'))).toBe(true)
    expect(isUnconfirmed(new TypeError('network'))).toBe(true)
    expect(isUnconfirmed(error(400, 'MESSAGE_INVALID'))).toBe(false)
    expect(isUnconfirmed(error(409, 'TURN_PENDING'))).toBe(false)
    expect(isUnconfirmed(error(429, 'TURN_LIMIT_REACHED'))).toBe(false)
    expect(isUnconfirmed(new LearnSessionError('ended'))).toBe(false)
  })
})

describe('fixtures keep each band to its sentence limit', () => {
  it.each(coBands)('%s replies', band => {
    const replies = [sourcedReply(band, 'EXAM'), beyondReply(band), clarifyReply(band), safetyReply(band, 'SAFE_REDIRECT'), safetyReply(band, 'TRUSTED_ADULT')]
    const texts = replies.flatMap(reply => [reply.text, reply.beyondNote ?? '', ...reply.suggestions, ...(reply.keyPoints ?? [])]).filter(Boolean)
    for (const text of texts) for (const sentence of sentences(text)) expect(words(sentence), `"${sentence}"`).toBeLessThanOrEqual(wordLimit[band])
    for (const suggestion of topics[band].suggestions) expect(words(suggestion)).toBeLessThanOrEqual(wordLimit[band] + 2)
  })
  it('kids replies are at most three sentences', () => {
    for (const reply of [sourcedReply('kids'), beyondReply('kids'), clarifyReply('kids')]) expect(sentences(reply.text).length).toBeLessThanOrEqual(3)
  })
})

describe('failure reasons for the platform failure codes', () => {
  it.each(['insufficient_source', 'unsafe_content', 'authorization_changed', 'context_unavailable', 'age_band_unsupported', 'cancelled'])('%s has its own sentence', code => {
    expect(failureMessage({ code })).not.toBe(failureMessage({ code: 'something_else' }))
  })
  it('never shows a raw code for the retryable ones', () => {
    for (const code of ['invalid_output', 'timeout', 'processor_unavailable', 'outcome_unavailable', 'processing_failed']) expect(failureMessage({ code })).toBe('Co could not finish that answer.')
  })
})
