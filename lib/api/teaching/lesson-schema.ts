import { z } from 'zod'

/*
 * B12 section 6.7: TeacherLessonContent 1.0 and the learner-side StudentLessonView.
 * - `teacherLessonContentSchema` mirrors the server hard rules so a draft that cannot be saved is reported before the request.
 * - `studentLessonViewSchema` is STRICT at every level: an answer key (`correctOptionId`) or an option `feedback` in a
 *   learner payload is a parse failure, never silently dropped (F-T3-08).
 * - The band lint is deterministic CoLearner code, not AI. It never blocks a save or publish.
 */
export type LessonBand = '6-9' | '10-13' | '14-17'
export const lessonBands = ['6-9', '10-13', '14-17'] as const satisfies readonly LessonBand[]
export const bandLabel: Record<LessonBand, string> = { '6-9': 'Ages 6-9', '10-13': 'Ages 10-13', '14-17': 'Ages 14-17' }
/** The three school bands by the learner-facing names used in the learn area. */
export const bandAudience: Record<LessonBand, string> = { '6-9': 'Kids', '10-13': 'Tweens', '14-17': 'Teens' }

export const stepKinds = ['INTRO', 'EXPLAIN', 'CHECK', 'EXAMPLE', 'RECAP'] as const
export type StepKind = (typeof stepKinds)[number]
export const stepKindLabel: Record<StepKind, string> = {
  INTRO: 'Introduction', EXPLAIN: 'Explain', CHECK: 'Check understanding', EXAMPLE: 'Example', RECAP: 'Recap',
}
export type LessonBlockType = 'TEXT' | 'LIST' | 'TABLE' | 'KEY_TERMS'

export const limits = {
  titleStep: 80, titleLesson: 120, objective: 160, objectives: 4, steps: 12, keyTerms: 8, stepKeyTerms: 6,
  coLine: 200, text: 2000, listItem: 300, listItems: 8, tableCols: 6, tableRows: 8, blocks: 8, checkBlocks: 3,
  sources: 6, options: 4, minOptions: 2, cell: 300, term: 120, definition: 500, question: 500, feedback: 500, hint: 300, optionText: 300, label: 80,
} as const

export interface LessonBlockText { type: 'TEXT'; text: string }
export interface LessonBlockList { type: 'LIST'; items: string[] }
export interface LessonBlockTable { type: 'TABLE'; headers: string[]; rows: string[][] }
export interface LessonBlockTerms { type: 'KEY_TERMS'; terms: { term: string; definition: string }[] }
export type LessonBlock = LessonBlockText | LessonBlockList | LessonBlockTable | LessonBlockTerms
export interface LessonCheckOption { id: string; text: string; feedback: string }
export interface LessonCheck { question: string; options: LessonCheckOption[]; correctOptionId: string; hint: string | null }
export interface LessonSource { materialId: string; label: string }
export interface LessonStep {
  id: string; kind: StepKind; title: string; coLine: string | null; blocks: LessonBlock[]; sources: LessonSource[]; check: LessonCheck | null
}
export interface TeacherLessonContent {
  schemaVersion: '1.0'; title: string; objectives: string[]; steps: LessonStep[]; keyTerms: { term: string; definition: string }[]; locale: 'en'
}

const term = z.object({ term: z.string().min(1).max(limits.term), definition: z.string().min(1).max(limits.definition) })
const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TEXT'), text: z.string().min(1).max(limits.text) }),
  z.object({ type: z.literal('LIST'), items: z.array(z.string().min(1).max(limits.listItem)).min(1).max(limits.listItems) }),
  z.object({
    type: z.literal('TABLE'),
    headers: z.array(z.string().min(1).max(limits.cell)).min(1).max(limits.tableCols),
    rows: z.array(z.array(z.string().max(limits.cell)).max(limits.tableCols)).min(1).max(limits.tableRows),
  }),
  z.object({ type: z.literal('KEY_TERMS'), terms: z.array(term).min(1).max(limits.stepKeyTerms) }),
])
const check = z.object({
  question: z.string().min(1).max(limits.question),
  options: z.array(z.object({ id: z.string().min(1).max(64), text: z.string().min(1).max(limits.optionText), feedback: z.string().max(limits.feedback) })).min(limits.minOptions).max(limits.options),
  correctOptionId: z.string().min(1).max(64),
  hint: z.string().max(limits.hint).nullable(),
})
const step = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(stepKinds),
  title: z.string().min(1).max(limits.titleStep),
  coLine: z.string().max(limits.coLine).nullable(),
  blocks: z.array(block).max(limits.blocks),
  sources: z.array(z.object({ materialId: z.string().min(1).max(128), label: z.string().min(1).max(limits.label) })).max(limits.sources),
  check: check.nullable(),
})
export const teacherLessonContentSchema = z.object({
  schemaVersion: z.literal('1.0'),
  title: z.string().min(1).max(limits.titleLesson),
  objectives: z.array(z.string().min(1).max(limits.objective)).min(1).max(limits.objectives),
  steps: z.array(step).min(1).max(limits.steps),
  keyTerms: z.array(term).max(limits.keyTerms),
  locale: z.literal('en'),
}).superRefine((content, ctx) => {
  const stepIds = new Set<string>()
  const optionIds = new Set<string>()
  content.steps.forEach((entry, index) => {
    const at = (...rest: (string | number)[]) => ['steps', index, ...rest]
    if (stepIds.has(entry.id)) ctx.addIssue({ code: 'custom', path: at('id'), message: 'Step ids must be unique.' })
    stepIds.add(entry.id)
    const isCheck = entry.kind === 'CHECK'
    if (isCheck) {
      if (entry.blocks.length > limits.checkBlocks) ctx.addIssue({ code: 'custom', path: at('blocks'), message: `A check step has at most ${limits.checkBlocks} blocks.` })
      if (!entry.check) ctx.addIssue({ code: 'custom', path: at('check'), message: 'A check step needs a question with answer options.' })
    } else {
      if (entry.blocks.length < 1) ctx.addIssue({ code: 'custom', path: at('blocks'), message: 'Add at least one block of content.' })
      if (entry.check) ctx.addIssue({ code: 'custom', path: at('check'), message: 'Only a check step has a question.' })
    }
    if (entry.check) {
      const ids = entry.check.options.map(option => option.id)
      if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: at('check', 'options'), message: 'Answer option ids must be unique.' })
      for (const id of ids) {
        if (optionIds.has(id)) ctx.addIssue({ code: 'custom', path: at('check', 'options'), message: 'Answer option ids must be unique in the lesson.' })
        optionIds.add(id)
      }
      if (!ids.includes(entry.check.correctOptionId)) ctx.addIssue({ code: 'custom', path: at('check', 'correctOptionId'), message: 'Mark exactly one option as correct.' })
    }
    entry.blocks.forEach((entryBlock, blockIndex) => {
      if (entryBlock.type === 'TABLE') entryBlock.rows.forEach((row, rowIndex) => {
        if (row.length !== entryBlock.headers.length) ctx.addIssue({ code: 'custom', path: at('blocks', blockIndex, 'rows', rowIndex), message: 'Each table row needs one cell per column.' })
      })
    })
  })
}) satisfies z.ZodType<TeacherLessonContent>

export interface ValidationIssue { path: string; message: string }
const pathText = (path: readonly PropertyKey[]) => path.map(part => typeof part === 'number' ? `[${part}]` : String(part)).join('.').replace(/\.\[/g, '[')
function humaneMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === 'too_small') return issue.origin === 'string' ? 'This cannot be empty.' : `Add at least ${String(issue.minimum)}.`
  if (issue.code === 'too_big') return issue.origin === 'string' ? `Shorten this to ${String(issue.maximum)} characters or fewer.` : `Use at most ${String(issue.maximum)}.`
  if (issue.code === 'invalid_value' || issue.code === 'invalid_type') return 'This is not valid.'
  return issue.message
}
/** Reports every reason a draft would be refused with 422 LESSON_INVALID, so the teacher can fix it before saving. */
export function validateLesson(content: TeacherLessonContent): ValidationIssue[] {
  const result = teacherLessonContentSchema.safeParse(content)
  if (result.success) return []
  return result.error.issues.map(issue => ({ path: pathText(issue.path), message: humaneMessage(issue) }))
}

/** Humane label for a validation path such as `steps[1].blocks[0].text`. */
export function describePath(path: string, content?: TeacherLessonContent): string {
  const match = /^steps\[(\d+)\]/.exec(path)
  if (match) {
    const index = Number(match[1])
    const title = content?.steps[index]?.title
    return `Step ${index + 1}${title ? ` (${title})` : ''}`
  }
  if (path.startsWith('objectives')) return 'Objectives'
  if (path.startsWith('keyTerms')) return 'Key terms'
  if (path.startsWith('title')) return 'Lesson title'
  return 'Lesson'
}

/* ---------- editor helpers ---------- */

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)

export function emptyCheck(): LessonCheck {
  const a = newId()
  return { question: '', options: [{ id: a, text: '', feedback: '' }, { id: newId(), text: '', feedback: '' }], correctOptionId: a, hint: null }
}
export function newBlock(type: LessonBlockType): LessonBlock {
  switch (type) {
    case 'TEXT': return { type, text: '' }
    case 'LIST': return { type, items: [''] }
    case 'TABLE': return { type, headers: ['', ''], rows: [['', '']] }
    case 'KEY_TERMS': return { type, terms: [{ term: '', definition: '' }] }
  }
}
export function newStep(kind: StepKind = 'EXPLAIN'): LessonStep {
  return { id: newId(), kind, title: '', coLine: null, blocks: kind === 'CHECK' ? [] : [newBlock('TEXT')], sources: [], check: kind === 'CHECK' ? emptyCheck() : null }
}
/** A starting point that is structurally complete but empty; the teacher fills it in. */
export function newLesson(title = ''): TeacherLessonContent {
  return { schemaVersion: '1.0', title, objectives: [''], steps: [newStep('INTRO')], keyTerms: [], locale: 'en' }
}
/** Changing a step's kind keeps its content valid: a check gains a question, any other kind drops it. */
export function withKind(entry: LessonStep, kind: StepKind): LessonStep {
  if (kind === 'CHECK') return { ...entry, kind, check: entry.check ?? emptyCheck() }
  return { ...entry, kind, check: null, blocks: entry.blocks.length > 0 ? entry.blocks : [newBlock('TEXT')] }
}
export const canonicalLesson = (content: TeacherLessonContent) => JSON.stringify(content)

/* ---------- band lint (deterministic, never blocks) ---------- */

export const sentenceWordLimit: Record<LessonBand, number> = { '6-9': 8, '10-13': 20, '14-17': 30 }
export interface LintIssue { path: string; rule: 'SENTENCE_LENGTH' | 'TABLE_BAND'; message: string }
const words = (sentence: string) => sentence.trim().split(/\s+/).filter(Boolean).length
/** The longest sentence in a passage, by whitespace-separated words. */
export function longestSentence(text: string): number {
  return text.split(/[.!?]+/).reduce((max, sentence) => Math.max(max, words(sentence)), 0)
}
export function lintLesson(content: TeacherLessonContent, band: LessonBand): LintIssue[] {
  const limit = sentenceWordLimit[band]
  const issues: LintIssue[] = []
  const check = (path: string, value: string | null | undefined) => {
    if (!value) return
    const longest = longestSentence(value)
    if (longest > limit) issues.push({ path, rule: 'SENTENCE_LENGTH', message: `A sentence has ${longest} words; the limit for ages ${band} is ${limit}.` })
  }
  content.steps.forEach((entry, index) => {
    const base = `steps[${index}]`
    check(`${base}.coLine`, entry.coLine)
    entry.blocks.forEach((entryBlock, blockIndex) => {
      const at = `${base}.blocks[${blockIndex}]`
      if (entryBlock.type === 'TEXT') check(`${at}.text`, entryBlock.text)
      else if (entryBlock.type === 'LIST') entryBlock.items.forEach((item, itemIndex) => check(`${at}.items[${itemIndex}]`, item))
      else if (entryBlock.type === 'TABLE' && band !== '14-17') issues.push({ path: at, rule: 'TABLE_BAND', message: `A table only suits ages 14-17; it is hard to read at ages ${band}.` })
    })
    if (entry.check) {
      entry.check.options.forEach((option, optionIndex) => {
        check(`${base}.check.options[${optionIndex}].text`, option.text)
        check(`${base}.check.options[${optionIndex}].feedback`, option.feedback)
      })
      check(`${base}.check.hint`, entry.check.hint)
    }
  })
  return issues
}

/* ---------- learner-side (strict) ---------- */

const viewTerm = z.strictObject({ term: z.string().max(limits.term), definition: z.string().max(limits.definition) })
const viewBlock = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('TEXT'), text: z.string().max(limits.text) }),
  z.strictObject({ type: z.literal('LIST'), items: z.array(z.string().max(limits.listItem)).max(limits.listItems) }),
  z.strictObject({ type: z.literal('TABLE'), headers: z.array(z.string().max(limits.cell)).max(limits.tableCols), rows: z.array(z.array(z.string().max(limits.cell)).max(limits.tableCols)).max(limits.tableRows) }),
  z.strictObject({ type: z.literal('KEY_TERMS'), terms: z.array(viewTerm).max(limits.stepKeyTerms) }),
])
export interface StudentLessonCheck { question: string; options: { id: string; text: string }[]; hint: string | null }
export interface StudentLessonStep { id: string; kind: StepKind; title: string; coLine: string | null; blocks: LessonBlock[]; sources: LessonSource[]; check: StudentLessonCheck | null }
export interface StudentLessonView { schemaVersion: '1.0'; title: string; objectives: string[]; steps: StudentLessonStep[]; keyTerms: { term: string; definition: string }[]; locale: 'en' }
/** `correctOptionId`, option `feedback` and `explanation` are not allowed keys: their presence fails the parse. */
export const studentLessonViewSchema = z.strictObject({
  schemaVersion: z.literal('1.0'),
  title: z.string().max(limits.titleLesson),
  objectives: z.array(z.string().max(limits.objective)).max(limits.objectives),
  steps: z.array(z.strictObject({
    id: z.string().min(1).max(64),
    kind: z.enum(stepKinds),
    title: z.string().max(limits.titleStep),
    coLine: z.string().max(limits.coLine).nullable(),
    blocks: z.array(viewBlock).max(limits.blocks),
    sources: z.array(z.strictObject({ materialId: z.string().min(1).max(128), label: z.string().max(limits.label) })).max(limits.sources),
    check: z.strictObject({
      question: z.string().max(limits.question),
      options: z.array(z.strictObject({ id: z.string().min(1).max(64), text: z.string().max(limits.optionText) })).max(limits.options),
      hint: z.string().max(limits.hint).nullable(),
    }).nullable(),
  })).min(1).max(limits.steps),
  keyTerms: z.array(viewTerm).max(limits.keyTerms),
  locale: z.literal('en'),
}) satisfies z.ZodType<StudentLessonView>

export const lessonCheckResultSchema = z.strictObject({
  correct: z.boolean(),
  feedback: z.string().max(limits.feedback),
  correctOptionId: z.string().min(1).max(64).nullable(),
})
export type LessonCheckResult = z.infer<typeof lessonCheckResultSchema>

export const bandFitIssueSchema = z.object({ path: z.string(), rule: z.string(), message: z.string() })
export const bandFitSchema = z.object({ band: z.enum(lessonBands), ok: z.boolean(), issues: z.array(bandFitIssueSchema) })
export type BandFit = z.infer<typeof bandFitSchema>
