import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkResultSchema, createLessonResponseSchema, isAccessChanged, isPlanItemId, leaksAnswerKey, lessonApi, lessonDetailSchema, lessonErrorMessage, lessonFailureText, notesAllowed, pollDelay, progressResponseSchema } from '@/lib/api/lesson'
import { LearnApiError } from '@/lib/api/learn-request'
import { answerKeys, lessonBands, lessonContentFixture, lessonDetailFixture } from '@/components/lesson/dev/lesson-fixtures'
import { buildScript, coPose, sentenceLimit, apiBandOf, sourceChipText, termIndexFor, uniqueSources } from '@/components/lesson/lesson-model'
import { pickLocalVoice, speechWords } from '@/lib/hooks/use-read-aloud'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', mocks.fetch) })
afterEach(() => { vi.unstubAllGlobals() })
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const envelope = (data: unknown) => ({ statusCode: 200, data, timestamp: 'now' })
const mutable = (band: 'kids' | 'tweens' | 'teens') => JSON.parse(JSON.stringify(lessonDetailFixture(band))) as ReturnType<typeof lessonDetailFixture>

describe('B08 lesson schemas', () => {
  it.each(lessonBands)('accept the %s lesson detail of the contract', band => {
    expect(lessonDetailSchema.safeParse(lessonDetailFixture(band)).success).toBe(true)
  })
  it('accepts every lifecycle state without content', () => {
    for (const status of ['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED'] as const) expect(lessonDetailSchema.safeParse(lessonDetailFixture('kids', { status, failure: status === 'FAILED' ? { code: 'x', retryable: true } : null })).success).toBe(true)
    expect(lessonDetailSchema.safeParse(lessonDetailFixture('teens', { content: null })).success).toBe(true)
  })
  it('keeps the learner payload free of the answer key: the fixtures carry none and the key stays server side', () => {
    for (const band of lessonBands) {
      const text = JSON.stringify(lessonDetailFixture(band))
      expect(text).not.toContain('correctOptionId')
      for (const option of answerKeys[band].options) expect(text).not.toContain(option.feedback)
      expect(leaksAnswerKey(lessonDetailFixture(band))).toBe(false)
    }
  })
  it('rejects any correctOptionId in the learner payload, at any depth', () => {
    const detail = mutable('teens')
    const check = detail.content!.steps[2]!.check!
    expect(lessonDetailSchema.safeParse({ ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 2 ? { ...s, check: { ...check, correctOptionId: 'pink' } } : s) } }).success).toBe(false)
    expect(lessonDetailSchema.safeParse({ ...detail, extra: { deep: [{ CorrectOptionId: 'pink' }] } }).success).toBe(false)
    expect(lessonDetailSchema.safeParse({ ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 2 ? { ...s, check: { ...check, options: check.options.map(o => ({ ...o, isCorrect: o.id === 'pink' })) } } : s) } }).success).toBe(false)
  })
  it('rejects per-option feedback inside the learner check (it is revealed by the check endpoint only)', () => {
    const detail = mutable('kids')
    const check = detail.content!.steps[2]!.check!
    const leaked = { ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 2 ? { ...s, check: { ...check, options: check.options.map(o => ({ ...o, feedback: 'Yes!' })) } } : s) } }
    expect(lessonDetailSchema.safeParse(leaked).success).toBe(false)
  })
  it('requires exactly five steps in order, a check only on the CHECK step, and valid kinds', () => {
    const detail = mutable('tweens')
    const steps = detail.content!.steps
    const withSteps = (value: unknown) => ({ ...detail, content: { ...detail.content, steps: value } })
    expect(lessonDetailSchema.safeParse(withSteps(steps.slice(0, 4))).success).toBe(false)
    expect(lessonDetailSchema.safeParse(withSteps([...steps].reverse())).success).toBe(false)
    expect(lessonDetailSchema.safeParse(withSteps(steps.map((s, i) => i === 1 ? { ...s, check: steps[2]!.check } : s))).success).toBe(false)
    expect(lessonDetailSchema.safeParse(withSteps(steps.map((s, i) => i === 2 ? { ...s, check: null } : s))).success).toBe(false)
    expect(lessonDetailSchema.safeParse(withSteps(steps.map((s, i) => i === 0 ? { ...s, kind: 'QUIZ' } : s))).success).toBe(false)
  })
  it('allows only the four block types and keeps lists, key terms and options within the contract', () => {
    const detail = mutable('teens')
    const first = (blocks: unknown) => ({ ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 0 ? { ...s, blocks } : s) } })
    expect(lessonDetailSchema.safeParse(first([{ type: 'IMAGE', src: 'https://x.test/a.png' }])).success).toBe(false)
    expect(lessonDetailSchema.safeParse(first([{ type: 'LIST', items: [] }])).success).toBe(false)
    expect(lessonDetailSchema.safeParse(first([{ type: 'KEY_TERMS', terms: [] }])).success).toBe(false)
    expect(lessonDetailSchema.safeParse(first([])).success).toBe(false)
    const oneOption = { ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 2 ? { ...s, check: { ...s.check, options: [s.check!.options[0]] } } : s) } }
    expect(lessonDetailSchema.safeParse(oneOption).success).toBe(false)
  })
  it('rejects unknown bands, progress outside 0..4 and notes without a step', () => {
    const detail = mutable('kids')
    expect(lessonDetailSchema.safeParse({ ...detail, lesson: { ...detail.lesson, band: '18+' } }).success).toBe(false)
    expect(lessonDetailSchema.safeParse({ ...detail, progress: { ...detail.progress, currentStep: 5 } }).success).toBe(false)
    expect(lessonDetailSchema.safeParse({ ...detail, notes: [{ id: 'n', text: 'x', createdAt: 'now' }] }).success).toBe(false)
    expect(lessonDetailSchema.safeParse({ ...detail, generatedBy: { kind: 'HUMAN', packVersion: '1', promptRelease: '1' } }).success).toBe(false)
  })
  it('check results reveal the answer only after a correct pick', () => {
    expect(checkResultSchema.safeParse({ correct: true, feedback: 'Yes', correctOptionId: 'a', attempt: 1 }).success).toBe(true)
    expect(checkResultSchema.safeParse({ correct: false, feedback: 'No', correctOptionId: null, attempt: 1 }).success).toBe(true)
    expect(checkResultSchema.safeParse({ correct: false, feedback: 'No', correctOptionId: 'a', attempt: 1 }).success).toBe(false)
  })
  it('reads a progress write answered with progress, or with a body that contains it', () => {
    const progress = { currentStep: 1, completedSteps: [0], completedAt: null, revision: 2 }
    expect(progressResponseSchema.parse(progress)).toEqual(progress)
    expect(progressResponseSchema.parse({ progress, lesson: {} })).toEqual(progress)
    expect(progressResponseSchema.safeParse({ currentStep: 9 }).success).toBe(false)
    expect(createLessonResponseSchema.safeParse({ lesson: lessonDetailFixture('kids').lesson }).success).toBe(true)
  })
  it('accepts the HOME completion route and empty generatedBy strings before READY', () => {
    const detail = lessonDetailFixture('kids', { status: 'QUEUED' })
    expect(detail.generatedBy).toEqual({ kind: 'AI', packVersion: '', promptRelease: '' })
    expect(detail.completion.home.route).toBe('HOME')
    expect(lessonDetailSchema.safeParse(detail).success).toBe(true)
  })
  it('treats a ready lesson without content, or a LESSON_ACCESS_CHANGED failure, as hidden', () => {
    expect(isAccessChanged(lessonDetailFixture('teens', { content: null }))).toBe(true)
    expect(isAccessChanged(lessonDetailFixture('teens', { status: 'FAILED', failure: { code: 'LESSON_ACCESS_CHANGED', retryable: false } }))).toBe(true)
    expect(isAccessChanged(lessonDetailFixture('teens'))).toBe(false)
  })
})

describe('fixtures keep the density the contract promises', () => {
  const sentences = (value: string) => value.split(/(?<=[.!?])\s+/).filter(Boolean)
  it.each(lessonBands)('%s: every spoken sentence stays within the age-band word limit', band => {
    const content = lessonContentFixture(band)
    const limit = sentenceLimit[apiBandOf(band)]
    const spoken = content.steps.flatMap(step => [step.coLine, ...step.blocks.flatMap(block => block.type === 'TEXT' ? [block.text] : block.type === 'LIST' ? block.items : []), ...(step.check ? [step.check.question, step.check.hint ?? '', ...step.check.options.map(option => option.text)] : [])])
    for (const line of spoken) for (const sentence of sentences(line)) expect(sentence.split(/\s+/).length, sentence).toBeLessThanOrEqual(limit)
    if (band === 'kids') expect(content.steps.every(step => step.blocks.length <= 3 && step.blocks.every(block => block.type !== 'TABLE'))).toBe(true)
  })
  it('kids get 2 to 3 options, tweens and teens 2 to 4', () => {
    expect(lessonContentFixture('kids').steps[2]!.check!.options.length).toBeLessThanOrEqual(3)
    expect(lessonContentFixture('teens').steps[2]!.check!.options.length).toBeLessThanOrEqual(4)
  })
})

describe('lesson presentation helpers', () => {
  it('maps Co poses to the contract per step', () => {
    expect(coPose('INTRO', 'kids')).toBe('waving'); expect(coPose('INTRO', 'teens')).toBe('curious')
    expect(coPose('EXPLAIN', 'kids')).toBe('explaining'); expect(coPose('EXPLAIN', 'tweens')).toBe('reading')
    expect(coPose('CHECK', 'tweens')).toBe('asking'); expect(coPose('CHECK', 'tweens', true)).toBe('hinting')
    expect(coPose('EXAMPLE', 'kids')).toBe('curious'); expect(coPose('EXAMPLE', 'teens')).toBe('explaining')
    expect(coPose('RECAP', 'kids')).toBe('celebrating'); expect(coPose('RECAP', 'teens')).toBe('encouraging')
  })
  it('builds a spoken script whose words line up with what is rendered', () => {
    const script = buildScript(lessonContentFixture('teens').steps[1]!)
    expect(script.text).toBe(script.segments.flatMap(segment => segment.words).join(' '))
    expect(speechWords(script.text)).toHaveLength(script.segments.reduce((sum, segment) => sum + segment.words.length, 0))
    expect(script.starts.coLine).toBe(0)
    expect(script.text).not.toMatch(/Litmus Red Blue/) // the table is not read aloud
    const check = buildScript(lessonContentFixture('kids').steps[2]!)
    expect(check.segments.map(segment => segment.id)).toEqual(expect.arrayContaining(['question', 'option0', 'option2']))
  })
  it('turns anchors into "From ..." chips once each', () => {
    expect(sourceChipText({ label: 'page 3' })).toBe('From page 3')
    expect(sourceChipText({ label: '2:14' })).toBe('From 2:14')
    expect(sourceChipText({ label: 'From section 3.2' })).toBe('From section 3.2')
    const one = { label: 'page 3', anchorRef: 'a', quote: 'q' }
    expect(uniqueSources([one, { ...one }, { ...one, label: 'page 4' }])).toHaveLength(2)
  })
  it('finds a lesson key term by name for saving to notes', () => {
    const content = lessonContentFixture('teens')
    expect(termIndexFor(content, ' indicator ')).toBe(0)
    expect(termIndexFor(content, 'Salt')).toBe(1)
    expect(termIndexFor(content, 'pH')).toBe(-1)
  })
  it('offers notes to 10-17 only', () => {
    expect([notesAllowed('6-9'), notesAllowed('10-13'), notesAllowed('14-17')]).toEqual([false, true, true])
  })
  it('polls with a growing but capped delay', () => {
    expect([0, 1, 2, 3].map(attempt => pollDelay(attempt))).toEqual([2000, 3000, 4500, 6750])
    expect(pollDelay(50)).toBe(15000)
    expect(pollDelay(0, 100)).toBe(100)
  })
  it('chooses only a local voice for the page language', () => {
    const voice = (lang: string, localService: boolean, name = lang) => ({ lang, localService, name }) as SpeechSynthesisVoice
    expect(pickLocalVoice([voice('en-GB', false, 'network'), voice('en-US', true, 'local')], 'en')?.name).toBe('local')
    expect(pickLocalVoice([voice('en-GB', false)], 'en')).toBeNull()
    expect(pickLocalVoice([voice('fr-FR', true)], 'en')).toBeNull()
    expect(pickLocalVoice([voice('en-GB', true, 'gb'), voice('en-US', true, 'us')], 'en-US')?.name).toBe('us')
    expect(pickLocalVoice([], 'en')).toBeNull()
  })
  it('never shows raw failure codes', () => {
    expect(lessonFailureText({ code: 'insufficient_source' })).toMatch(/not enough/)
    expect(lessonFailureText({ code: 'weird_internal_error' })).toBe('Co could not finish this lesson. You can try again.')
    expect(lessonFailureText(null)).toMatch(/could not finish/)
    const typed = new LearnApiError(403, 'safe server reason', 'POLICY_BLOCKED')
    expect(lessonErrorMessage(typed)).toBe('safe server reason')
    expect(lessonErrorMessage(new LearnApiError(409, 'generic', 'MATERIAL_NOT_READY'))).toMatch(/still being read/)
    expect(lessonErrorMessage(new LearnApiError(503, 'Learning services are unavailable.'))).toBe('Learning services are unavailable.')
  })
})

describe('lesson HTTP boundary (mocked HTTP; the platform lesson module is built in parallel)', () => {
  it('uses the same-origin BFF with the right verbs and bodies', async () => {
    mocks.fetch.mockImplementation(async () => reply(envelope({ lesson: lessonDetailFixture('kids').lesson })))
    await lessonApi.create({ materialId: 'm1', planItemId: 'i1' })
    expect(mocks.fetch.mock.calls[0]).toEqual(['/api/learn/lessons', expect.objectContaining({ method: 'POST', body: '{"materialId":"m1","planItemId":"i1"}' })])
    mocks.fetch.mockImplementation(async () => reply(envelope({ currentStep: 1, completedSteps: [0], completedAt: null, revision: 1 })))
    await lessonApi.progress('l1', { currentStep: 1, completedStep: 0, revision: 0 })
    expect(mocks.fetch.mock.calls[1]).toEqual(['/api/learn/lessons/l1/progress', expect.objectContaining({ method: 'PUT', body: '{"currentStep":1,"completedStep":0,"revision":0}' })])
    mocks.fetch.mockImplementation(async () => reply(envelope({ correct: false, feedback: 'No', correctOptionId: null, attempt: 1 })))
    await lessonApi.check('l1', { stepIndex: 2, optionId: 'a' })
    expect(mocks.fetch.mock.calls[2]![1]).toMatchObject({ method: 'POST', body: '{"stepIndex":2,"optionId":"a"}' })
    mocks.fetch.mockImplementation(async () => reply(envelope({ lesson: lessonDetailFixture('kids').lesson })))
    await expect(lessonApi.retry('l1')).resolves.toMatchObject({ lesson: { id: 'lesson-fixture' } })
    mocks.fetch.mockImplementation(async () => reply(envelope({})))
    await lessonApi.complete('l1'); await lessonApi.cancel('l1'); await lessonApi.addNote('l1', { stepIndex: 1, text: 'hi' })
    expect(mocks.fetch.mock.calls.slice(3).map(call => call[0])).toEqual(['/api/learn/lessons/l1/retry', '/api/learn/lessons/l1/complete', '/api/learn/lessons/l1/cancel', '/api/learn/lessons/l1/notes'])
    expect(mocks.fetch.mock.calls.every(call => !('Authorization' in (call[1].headers ?? {})))).toBe(true)
  })
  it('deletes a note, accepting an empty 204 answer, and encodes ids', async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 204 }))
    await expect(lessonApi.deleteNote('l 1', 'n/1')).resolves.toBeUndefined()
    expect(mocks.fetch.mock.calls[0]).toEqual(['/api/learn/lessons/l%201/notes/n%2F1', expect.objectContaining({ method: 'DELETE' })])
    expect(mocks.fetch.mock.calls[0]![1].body).toBeUndefined()
  })
  it('refuses a detail that leaks the answer, as an unexpected response (not stored)', async () => {
    const detail = mutable('kids')
    const check = detail.content!.steps[2]!.check!
    mocks.fetch.mockResolvedValue(reply(envelope({ ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 2 ? { ...s, check: { ...check, correctOptionId: 'roots' } } : s) } })))
    await expect(lessonApi.detail('l1')).rejects.toMatchObject({ status: 502 })
  })
  it('carries typed error codes and a safe POLICY_BLOCKED reason', async () => {
    mocks.fetch.mockResolvedValue(reply({ code: 'POLICY_BLOCKED', message: 'Lessons are paused until tomorrow.' }, 403))
    await expect(lessonApi.create({ materialId: 'm1' })).rejects.toMatchObject({ status: 403, code: 'POLICY_BLOCKED', message: 'Lessons are paused until tomorrow.' })
    mocks.fetch.mockResolvedValue(reply({ code: 'PROGRESS_CONFLICT' }, 409))
    await expect(lessonApi.progress('l1', { currentStep: 1, revision: 0 })).rejects.toMatchObject({ status: 409, code: 'PROGRESS_CONFLICT' })
    mocks.fetch.mockResolvedValue(reply({ code: 'NOTES_NOT_AVAILABLE' }, 403))
    await expect(lessonApi.addNote('l1', { stepIndex: 0, text: 'x' })).rejects.toMatchObject({ code: 'NOTES_NOT_AVAILABLE' })
  })
})

describe('platform contract (lesson.v1.openapi.json and lesson-contracts.ts are the source of truth)', () => {
  const platformCodes = ['CHILD_PROFILE_REQUIRED', 'AGE_OUT_OF_SCOPE', 'CONSENT_REQUIRED', 'NOTES_NOT_AVAILABLE', 'LESSON_ACCESS_CHANGED', 'MATERIAL_NOT_READY', 'LESSONS_UNAVAILABLE', 'LESSON_NOT_READY', 'LESSON_INCOMPLETE', 'PROGRESS_CONFLICT', 'STEP_ORDER', 'CHECK_REQUIRED', 'NOT_RETRYABLE', 'NOT_CANCELLABLE', 'NOTE_LIMIT_REACHED', 'DAILY_LESSON_LIMIT', 'CHECK_LIMIT']
  it.each(platformCodes)('has learner copy of its own for the platform code %s (never the generic status text)', code => {
    const message = lessonErrorMessage(new LearnApiError(409, 'generic status text', code))
    expect(message).not.toBe('generic status text')
    expect(message).not.toContain(code)
  })
  it('takes a plan item id as a uuid only, because the platform body is strict', () => {
    expect(isPlanItemId('3f2b1c9e-6d1a-4c55-9a53-0d9c5e2f7b10')).toBe(true)
    for (const value of ['item-1', 'plan-7', '', null, undefined, '../x', '3f2b1c9e6d1a4c559a530d9c5e2f7b10']) expect(isPlanItemId(value)).toBe(false)
  })
  it('reads the progress receipt {progress} the platform answers, and a PROGRESS_CONFLICT keeps its code', async () => {
    const progress = { currentStep: 2, completedSteps: [0, 1], completedAt: null, revision: 3 }
    mocks.fetch.mockImplementation(async () => reply(envelope({ progress })))
    await expect(lessonApi.progress('l1', { currentStep: 2, completedStep: 1, revision: 2 })).resolves.toEqual(progress)
    mocks.fetch.mockResolvedValue(reply({ statusCode: 409, code: 'PROGRESS_CONFLICT', message: 'Your progress changed somewhere else. Reload to continue.', progress }, 409))
    await expect(lessonApi.progress('l1', { currentStep: 2, revision: 0 })).rejects.toMatchObject({ status: 409, code: 'PROGRESS_CONFLICT' })
  })
  it('reads the canonical stored blocks: TABLE rows as string[][] and KEY_TERMS, with the 14-17 step views the platform builds', () => {
    const detail = mutable('teens')
    const blocks = [
      { type: 'TABLE', headers: ['Indicator', 'In acid'], rows: [['Litmus', 'Red'], ['Methyl orange', 'Red']] },
      { type: 'KEY_TERMS', terms: [{ term: 'Indicator', definition: 'A dye that changes colour.' }] },
      { type: 'LIST', items: ['one'] }, { type: 'TEXT', text: 'text' },
    ]
    const withBlocks = { ...detail, content: { ...detail.content, steps: detail.content!.steps.map((s, i) => i === 1 ? { ...s, blocks } : s) } }
    const parsed = lessonDetailSchema.safeParse(withBlocks)
    expect(parsed.success).toBe(true)
    // The flat runtime form ({cells} rows, null members) is normalised by the platform before storage and is not accepted here.
    const flat = { ...withBlocks, content: { ...withBlocks.content, steps: withBlocks.content.steps.map((s, i) => i === 1 ? { ...s, blocks: [{ type: 'TABLE', headers: ['a'], rows: [{ cells: ['x'] }] }] } : s) } }
    expect(lessonDetailSchema.safeParse(flat).success).toBe(false)
  })
  it('accepts the detail of a lesson that is still being made: no content, default progress, empty pack strings, an UNAVAILABLE Ask Co', () => {
    const queued = lessonDetailFixture('tweens', { status: 'QUEUED' })
    const wire = { ...queued, content: null, progress: { currentStep: 0, completedSteps: [], completedAt: null, revision: 0 }, askCo: { status: 'UNAVAILABLE', reason: 'Asking Co questions inside a lesson is not available yet.' }, completion: { practice: { link: { route: 'PRACTICE', id: 'm1', planId: 'p1' }, enabled: false, disabledReason: 'Practice opens when the practice player is released.' }, home: { route: 'HOME', id: null } }, source: { materialLink: { route: 'LIBRARY_ITEM', id: 'm1', planId: 'p1' } } }
    expect(lessonDetailSchema.safeParse(wire).success).toBe(true)
  })
})
