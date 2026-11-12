import { z } from 'zod'
import { newId } from './lesson-schema'

/*
 * B13 section 5 and 6. Local Zod mirror of the question bank contract. `@colearner/api-client` 0.10.0 (TeachingQuestion* types)
 * is not vendored into the web yet (the web pins 0.4.0 and keeps local schemas, the B12 precedent), so the shapes are declared
 * here as interfaces and each schema is checked against its interface with `satisfies z.ZodType<...>`. When the client is
 * vendored, swap these interfaces for the generated types; the schemas then fail to compile if the contract moved.
 */
export const questionTypes = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'LONG_ANSWER', 'CODE', 'PICTURE_CHOICE', 'ORDERING'] as const
export type QuestionType = (typeof questionTypes)[number]
export const difficulties = ['EASY', 'MEDIUM', 'HARD'] as const
export type QuestionDifficulty = (typeof difficulties)[number]
export const questionOrigins = ['MANUAL', 'CO', 'CSV', 'LEGACY'] as const
export type QuestionOrigin = (typeof questionOrigins)[number]
export const questionStatuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type QuestionStatus = (typeof questionStatuses)[number]
export const reviewStates = ['NONE', 'PENDING_REVIEW', 'ACCEPTED', 'EDITED', 'REJECTED'] as const
export type QuestionReviewState = (typeof reviewStates)[number]
export const flagKinds = ['DUPLICATE', 'AMBIGUOUS', 'KEY_DOUBT', 'LEVEL_MISMATCH'] as const
export type QuestionFlagKind = (typeof flagKinds)[number]
export const hintRungs = ['NUDGE', 'HINT', 'SIMILAR_EXAMPLE'] as const
export type HintRung = (typeof hintRungs)[number]
export const codeLanguages = ['python', 'javascript', 'java', 'c', 'cpp', 'scratch-text', 'other'] as const

/** Types a learner player does not exist for (D3, D4): they can be authored and printed, never shown to learners. */
export const authorOnlyTypes: readonly QuestionType[] = ['CODE', 'PICTURE_CHOICE', 'ORDERING']
/** Types Co may draft (contract 6.3). */
export const coDraftTypes = ['MCQ', 'MULTI_SELECT', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER', 'LONG_ANSWER'] as const satisfies readonly QuestionType[]

export const typeLabel: Record<QuestionType, string> = {
  MCQ: 'Multiple choice', MULTI_SELECT: 'Select all that apply', TRUE_FALSE: 'True or false', FILL_BLANK: 'Fill in the blank',
  SHORT_ANSWER: 'Short answer', LONG_ANSWER: 'Long answer', CODE: 'Code', PICTURE_CHOICE: 'Picture choice', ORDERING: 'Ordering',
}
export const difficultyLabel: Record<QuestionDifficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }
export const originLabel: Record<QuestionOrigin, string> = { MANUAL: 'Written by you', CO: 'Drafted by Co', CSV: 'CSV import', LEGACY: 'Earlier question' }
export const statusLabel: Record<QuestionStatus, string> = { DRAFT: 'Draft', PUBLISHED: 'Published', ARCHIVED: 'Archived' }
export const reviewLabel: Record<QuestionReviewState, string> = { NONE: 'No review needed', PENDING_REVIEW: 'Waiting for your review', ACCEPTED: 'Accepted', EDITED: 'Edited by you', REJECTED: 'Rejected' }
export const flagLabel: Record<QuestionFlagKind, string> = { DUPLICATE: 'Duplicate', AMBIGUOUS: 'Ambiguous wording', KEY_DOUBT: 'Answer key may be wrong', LEVEL_MISMATCH: 'Level may not fit' }
export const rungLabel: Record<HintRung, string> = { NUDGE: 'Nudge', HINT: 'Hint', SIMILAR_EXAMPLE: 'Similar example' }
export const rungHelp: Record<HintRung, string> = {
  NUDGE: 'A small push that points the learner in the right direction without giving the method away.',
  HINT: 'A clearer clue that narrows down what to do next.',
  SIMILAR_EXAMPLE: 'A worked example with different numbers or words.',
}

/* ---------- content (section 5) ---------- */

export interface QuestionOption { id: string; label: string }
export type CorrectAnswer =
  | { kind: 'option'; optionId: string }
  | { kind: 'options'; optionIds: string[] }
  | { kind: 'blanks'; blanks: string[][] }
  | { kind: 'order'; optionIds: string[] }
  | { kind: 'text'; sample: string }
  | { kind: 'code'; sample: string; language: string }
export interface QuestionHint { rung: HintRung; text: string }
export interface QuestionMedia { optionImages?: Record<string, string>; language?: string; starterCode?: string }
export interface QuestionContent {
  schemaVersion: '1.0'
  type: QuestionType
  topicId: string
  difficulty: QuestionDifficulty | null
  prompt: string
  options: QuestionOption[] | null
  correctAnswer: CorrectAnswer
  rubric: string | null
  explanation: string
  hints: QuestionHint[]
  media: QuestionMedia | null
  referenceMaterialIds: string[]
}

const text = z.string()
export const correctAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('option'), optionId: text }),
  z.object({ kind: z.literal('options'), optionIds: z.array(text) }),
  z.object({ kind: z.literal('blanks'), blanks: z.array(z.array(text)) }),
  z.object({ kind: z.literal('order'), optionIds: z.array(text) }),
  z.object({ kind: z.literal('text'), sample: text }),
  z.object({ kind: z.literal('code'), sample: text, language: text }),
]) satisfies z.ZodType<CorrectAnswer>
export const questionContentSchema = z.object({
  schemaVersion: z.literal('1.0'),
  type: z.enum(questionTypes),
  topicId: text,
  difficulty: z.enum(difficulties).nullable(),
  prompt: text,
  options: z.array(z.object({ id: text, label: text })).nullable(),
  correctAnswer: correctAnswerSchema,
  rubric: text.nullable(),
  explanation: text,
  hints: z.array(z.object({ rung: z.enum(hintRungs), text })),
  media: z.object({ optionImages: z.record(z.string(), text).optional(), language: text.optional(), starterCode: text.optional() }).nullable(),
  referenceMaterialIds: z.array(text),
}) satisfies z.ZodType<QuestionContent>

/* ---------- list and detail (6.1, 6.2) ---------- */

export interface QuestionFlag { id?: string; kind: QuestionFlagKind; source: 'DETERMINISTIC' | 'CO'; note: string; relatedQuestionId: string | null }
export interface QuestionListItem {
  id: string; planId: string; planTitle: string; topicId: string; topicTitle: string; type: QuestionType; difficulty: QuestionDifficulty | null
  status: QuestionStatus; reviewState: QuestionReviewState; origin: QuestionOrigin; version: number; promptPreview: string; hasDraftRevision: boolean
  successRate: { value: number; attempts: number } | null; flags: QuestionFlag[]; authorOnly: boolean; updatedAt: string
}
export interface QuestionProvenance {
  origin: QuestionOrigin; packVersion: string | null; promptRelease: string | null; traceId: string | null; batchId: string | null; importId: string | null
  authoredBy: string | null; reviewedBy: string | null; reviewedAt: string | null; approvedBy: string | null
}
export interface QuestionRevisionSummary { revision: number; state: 'DRAFT' | 'PUBLISHED' | 'DISCARDED'; publishedAt: string | null; publishedBy: string | null }
export interface QuestionDetail extends QuestionListItem {
  content: QuestionContent
  draftRevision: { revision: number; content: QuestionContent; updatedAt: string } | null
  revisions: QuestionRevisionSummary[]
  provenance: QuestionProvenance
}
export interface QuestionFacets { types: Record<string, number>; origins: Record<string, number>; statuses: Record<string, number> }
export interface QuestionList { items: QuestionListItem[]; facets: QuestionFacets; nextCursor: string | null }

const iso = z.string().min(1)
const nullableText = z.string().nullable()
export const questionFlagSchema = z.object({
  id: z.string().optional(), kind: z.enum(flagKinds), source: z.enum(['DETERMINISTIC', 'CO']), note: z.string(), relatedQuestionId: nullableText,
}) satisfies z.ZodType<QuestionFlag>
export const questionListItemSchema = z.object({
  id: z.string().min(1), planId: z.string(), planTitle: z.string(), topicId: z.string(), topicTitle: z.string(), type: z.enum(questionTypes),
  difficulty: z.enum(difficulties).nullable(), status: z.enum(questionStatuses), reviewState: z.enum(reviewStates), origin: z.enum(questionOrigins),
  version: z.number().int().nonnegative(), promptPreview: z.string(), hasDraftRevision: z.boolean(),
  successRate: z.object({ value: z.number().min(0).max(1), attempts: z.number().int().nonnegative() }).nullable(),
  flags: z.array(questionFlagSchema), authorOnly: z.boolean(), updatedAt: iso,
}) satisfies z.ZodType<QuestionListItem>
const provenanceSchema = z.object({
  origin: z.enum(questionOrigins), packVersion: nullableText, promptRelease: nullableText, traceId: nullableText, batchId: nullableText, importId: nullableText,
  authoredBy: nullableText, reviewedBy: nullableText, reviewedAt: nullableText, approvedBy: nullableText,
}) satisfies z.ZodType<QuestionProvenance>
export const questionDetailSchema = questionListItemSchema.extend({
  content: questionContentSchema,
  draftRevision: z.object({ revision: z.number().int(), content: questionContentSchema, updatedAt: iso }).nullable(),
  revisions: z.array(z.object({ revision: z.number().int(), state: z.enum(['DRAFT', 'PUBLISHED', 'DISCARDED']), publishedAt: nullableText, publishedBy: nullableText })),
  provenance: provenanceSchema,
}) satisfies z.ZodType<QuestionDetail>
/** Single-question responses are `{ question }`; a bare detail is accepted too so a write route may return either. */
export const questionEnvelopeSchema = z.union([questionDetailSchema, z.object({ question: questionDetailSchema }).transform(value => value.question)])
const countMap = z.record(z.string(), z.number().int().nonnegative())
export const questionListSchema = z.object({
  items: z.array(questionListItemSchema), facets: z.object({ types: countMap, origins: countMap, statuses: countMap }), nextCursor: nullableText,
}) satisfies z.ZodType<QuestionList>

/* ---------- authoring helpers ---------- */

const optionTypes: readonly QuestionType[] = ['MCQ', 'MULTI_SELECT', 'PICTURE_CHOICE', 'ORDERING']
export const hasOptions = (type: QuestionType) => optionTypes.includes(type)
export const isFreeText = (type: QuestionType) => type === 'SHORT_ANSWER' || type === 'LONG_ANSWER'
export const optionLimits = (type: QuestionType) => (type === 'ORDERING' ? { min: 2, max: 10 } : { min: 2, max: 8 })
export const blankMarker = '___'
export const countBlanks = (prompt: string) => prompt.split(blankMarker).length - 1
export const TRUE_FALSE_OPTIONS: QuestionOption[] = [{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }]

const freshOptions = (count: number): QuestionOption[] => Array.from({ length: count }, () => ({ id: newId(), label: '' }))

/** A blank question of a type. Switching type keeps what applies (prompt, topic, difficulty, explanation, hints, references). */
export function contentForType(type: QuestionType, base?: Partial<QuestionContent>): QuestionContent {
  const common = {
    schemaVersion: '1.0' as const, topicId: base?.topicId ?? '', difficulty: base?.difficulty ?? null, prompt: base?.prompt ?? '',
    explanation: base?.explanation ?? '', hints: base?.hints ?? [], referenceMaterialIds: base?.referenceMaterialIds ?? [],
  }
  if (type === 'MCQ' || type === 'PICTURE_CHOICE') {
    const options = freshOptions(4)
    return { ...common, type, options, correctAnswer: { kind: 'option', optionId: options[0]!.id }, rubric: null, media: type === 'PICTURE_CHOICE' ? { optionImages: {} } : null }
  }
  if (type === 'MULTI_SELECT') { const options = freshOptions(4); return { ...common, type, options, correctAnswer: { kind: 'options', optionIds: [options[0]!.id] }, rubric: null, media: null } }
  if (type === 'ORDERING') { const options = freshOptions(3); return { ...common, type, options, correctAnswer: { kind: 'order', optionIds: options.map(o => o.id) }, rubric: null, media: null } }
  if (type === 'TRUE_FALSE') return { ...common, type, options: TRUE_FALSE_OPTIONS.map(o => ({ ...o })), correctAnswer: { kind: 'option', optionId: 'true' }, rubric: null, media: null }
  if (type === 'FILL_BLANK') return { ...common, type, options: null, correctAnswer: { kind: 'blanks', blanks: [[]] }, rubric: null, media: null }
  if (type === 'CODE') return { ...common, type, options: null, correctAnswer: { kind: 'code', sample: '', language: 'python' }, rubric: null, media: { language: 'python', starterCode: '' } }
  return { ...common, type, options: null, correctAnswer: { kind: 'text', sample: '' }, rubric: base?.rubric ?? '', media: null }
}

/** Keeps the blank answer list the same length as the `___` markers in the prompt (extra rows dropped, missing rows empty). */
export function syncBlanks(content: QuestionContent): QuestionContent {
  if (content.correctAnswer.kind !== 'blanks') return content
  const wanted = Math.max(countBlanks(content.prompt), 1)
  const current = content.correctAnswer.blanks
  if (current.length === wanted) return content
  return { ...content, correctAnswer: { kind: 'blanks', blanks: Array.from({ length: wanted }, (_, index) => current[index] ?? []) } }
}

/** What goes on the wire: trimmed text, empty hints dropped, rungs in a fixed order, fields that do not apply to the type cleared. */
export function normaliseContent(content: QuestionContent): QuestionContent {
  const trim = (value: string) => value.trim()
  const options = content.options && content.type !== 'TRUE_FALSE' ? content.options.map(o => ({ id: o.id, label: trim(o.label) })) : content.options
  let correctAnswer = content.correctAnswer
  if (correctAnswer.kind === 'blanks') correctAnswer = { kind: 'blanks', blanks: correctAnswer.blanks.map(list => list.map(trim).filter(Boolean)) }
  if (correctAnswer.kind === 'text') correctAnswer = { kind: 'text', sample: trim(correctAnswer.sample) }
  if (correctAnswer.kind === 'code') correctAnswer = { kind: 'code', sample: correctAnswer.sample.replace(/\s+$/, ''), language: correctAnswer.language }
  const hints = hintRungs.flatMap(rung => {
    const entry = content.hints.find(h => h.rung === rung)
    return entry && trim(entry.text) ? [{ rung, text: trim(entry.text) }] : []
  })
  let media = content.media
  if (content.type === 'PICTURE_CHOICE') {
    const ids = new Set((options ?? []).map(o => o.id))
    media = { optionImages: Object.fromEntries(Object.entries(content.media?.optionImages ?? {}).filter(([id, material]) => ids.has(id) && material)) }
  } else if (content.type === 'CODE' && correctAnswer.kind === 'code') {
    media = { language: correctAnswer.language, starterCode: content.media?.starterCode ?? '' }
  } else media = null
  return {
    ...content, prompt: trim(content.prompt), options, correctAnswer, hints, media, explanation: trim(content.explanation),
    rubric: isFreeText(content.type) ? trim(content.rubric ?? '') : null,
  }
}

/* ---------- validation mirror (the server is the authority; this points at the field before the request) ---------- */

export interface QuestionIssue { path: string; code: string; message: string }

export function validateQuestion(input: QuestionContent): QuestionIssue[] {
  const issues: QuestionIssue[] = []
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message })
  const content = normaliseContent(input)
  if (!content.topicId) add('topicId', 'REQUIRED', 'Choose a topic.')
  if (!content.prompt) add('prompt', 'REQUIRED', 'Write the question.')
  else if (content.prompt.length > 2000) add('prompt', 'TOO_LONG', 'The question can be at most 2000 characters.')
  const options = content.options ?? []
  if (hasOptions(content.type)) {
    const { min, max } = optionLimits(content.type)
    if (options.length < min || options.length > max) add('options', 'COUNT', `Use ${min} to ${max} ${content.type === 'ORDERING' ? 'items' : 'options'}.`)
    options.forEach((option, index) => { if (!option.label) add(`options.${index}.label`, 'REQUIRED', content.type === 'ORDERING' ? 'Write this item.' : 'Write this option.') })
    if (new Set(options.map(o => o.label.toLowerCase()).filter(Boolean)).size < options.filter(o => o.label).length) add('options', 'DUPLICATE', 'Two options say the same thing.')
  }
  const answer = content.correctAnswer
  const known = new Set(options.map(o => o.id))
  if (content.type === 'MCQ' || content.type === 'PICTURE_CHOICE' || content.type === 'TRUE_FALSE') {
    if (answer.kind !== 'option' || !known.has(answer.optionId) && content.type !== 'TRUE_FALSE') add('correctAnswer', 'REQUIRED', 'Mark the correct answer.')
    if (content.type === 'TRUE_FALSE' && !(answer.kind === 'option' && (answer.optionId === 'true' || answer.optionId === 'false'))) add('correctAnswer', 'REQUIRED', 'Choose true or false.')
  } else if (content.type === 'MULTI_SELECT') {
    if (answer.kind !== 'options' || answer.optionIds.length < 1 || !answer.optionIds.every(id => known.has(id))) add('correctAnswer', 'REQUIRED', 'Mark at least one correct option.')
  } else if (content.type === 'ORDERING') {
    if (answer.kind !== 'order' || answer.optionIds.length !== options.length || !answer.optionIds.every(id => known.has(id)) || new Set(answer.optionIds).size !== options.length) add('correctAnswer', 'ORDER', 'List every item once, in the correct order.')
  } else if (content.type === 'FILL_BLANK') {
    const blanks = countBlanks(content.prompt)
    if (blanks < 1) add('prompt', 'BLANK_MARKER', `Put ${blankMarker} where each blank goes.`)
    if (answer.kind !== 'blanks' || answer.blanks.length !== blanks) add('correctAnswer', 'BLANK_COUNT', 'Each blank needs its accepted answers.')
    else answer.blanks.forEach((list, index) => { if (list.length === 0) add(`correctAnswer.blanks.${index}`, 'REQUIRED', `Add at least one accepted answer for blank ${index + 1}.`) })
  } else if (content.type === 'SHORT_ANSWER' || content.type === 'LONG_ANSWER') {
    if (answer.kind !== 'text' || !answer.sample) add('correctAnswer', 'REQUIRED', 'Write a model answer.')
    if (!content.rubric) add('rubric', 'REQUIRED', 'Write a rubric so marking is consistent.')
    else if (content.rubric.length > 2000) add('rubric', 'TOO_LONG', 'The rubric can be at most 2000 characters.')
  } else if (content.type === 'CODE') {
    if (answer.kind !== 'code' || !answer.sample) add('correctAnswer', 'REQUIRED', 'Write a model solution.')
    else if (!(codeLanguages as readonly string[]).includes(answer.language)) add('correctAnswer.language', 'LANGUAGE', 'Choose a language from the list.')
  }
  if (content.type === 'PICTURE_CHOICE') options.forEach((option, index) => { if (!content.media?.optionImages?.[option.id]) add(`options.${index}.image`, 'REQUIRED', 'Choose a picture for this option.') })
  if (content.explanation.length > 2000) add('explanation', 'TOO_LONG', 'The explanation can be at most 2000 characters.')
  content.hints.forEach((hint, index) => { if (hint.text.length > 500) add(`hints.${index}.text`, 'TOO_LONG', 'A hint can be at most 500 characters.') })
  return issues
}

/** Looks up the first issue for a field or any field below it. */
export const issueFor = (issues: QuestionIssue[], path: string) => issues.find(issue => issue.path === path || issue.path.startsWith(`${path}.`))
export const issuesUnder = (issues: QuestionIssue[], path: string) => issues.filter(issue => issue.path === path || issue.path.startsWith(`${path}.`))

/** A plain-words summary of the answer for a review card or a preview. Never invented: it reads the saved key. */
export function answerSummary(content: QuestionContent): string {
  const answer = content.correctAnswer
  const label = (id: string) => content.options?.find(o => o.id === id)?.label ?? id
  switch (answer.kind) {
    case 'option': return label(answer.optionId)
    case 'options': return answer.optionIds.map(label).join(', ')
    case 'order': return answer.optionIds.map(label).join(' → ')
    case 'blanks': return answer.blanks.map((list, index) => `${index + 1}. ${list.join(' / ')}`).join('   ')
    case 'text': return answer.sample
    case 'code': return answer.sample
  }
}
