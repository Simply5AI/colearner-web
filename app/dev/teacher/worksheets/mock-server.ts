import { createMockTeaching } from '../plans/mock-server'

/*
 * DEVELOPMENT FIXTURE ONLY (B13 W2). An in-memory stand-in for contract sections 6.1 (bank list slice), 6.5 (CSV import) and
 * 6.6 (worksheets), built in parallel with the platform. Every question, worksheet and import result here is a labelled fixture,
 * not a real platform response, and nothing here is AI output. Plan and topic routes come from the B12 plan fixture.
 */
export interface MockResponse { status: number; body?: unknown }
type Json = Record<string, unknown>
const iso = (offsetMs = 0) => new Date(Date.UTC(2026, 9, 31, 8, 0, 0) + offsetMs).toISOString()
const ok = (body: unknown, status = 200): MockResponse => ({ status, body: { statusCode: status, data: body, timestamp: iso() } })
const fail = (status: number, code: string, extra: Json = {}): MockResponse => ({ status, body: { statusCode: status, code, message: code, ...extra } })

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
interface Option { id: string; label: string }
type Answer =
  | { kind: 'option'; optionId: string } | { kind: 'options'; optionIds: string[] } | { kind: 'blanks'; blanks: string[][] }
  | { kind: 'order'; optionIds: string[] } | { kind: 'text'; sample: string } | { kind: 'code'; sample: string; language: string }
export interface FixtureQuestion {
  id: string; topicId: string; topicTitle: string; type: string; difficulty: Difficulty; version: number; prompt: string
  options: Option[] | null; correctAnswer: Answer; explanation: string; rubric: string | null; hints: { rung: string; text: string }[]
  media: Json | null; authorOnly: boolean; successRate: { value: number; attempts: number } | null
}
const opts = (...labels: string[]): Option[] => labels.map((label, index) => ({ id: `o${index + 1}`, label }))
const pic = (id: string) => `mat-img-${id}`

export const FIXTURE_QUESTIONS: FixtureQuestion[] = [
  { id: 'q-1', topicId: 'topic-parts', topicTitle: 'Parts of a whole', type: 'MCQ', difficulty: 'EASY', version: 2, prompt: 'A pizza is cut into 8 equal slices. You eat 3 slices. What fraction of the pizza did you eat?', options: opts('3/8', '5/8', '3/5', '8/3'), correctAnswer: { kind: 'option', optionId: 'o1' }, explanation: 'You ate 3 of the 8 equal slices, so the fraction is 3/8.', rubric: null, hints: [{ rung: 'NUDGE', text: 'How many slices are there in total?' }], media: null, authorOnly: false, successRate: { value: 0.82, attempts: 41 } },
  { id: 'q-2', topicId: 'topic-parts', topicTitle: 'Parts of a whole', type: 'TRUE_FALSE', difficulty: 'EASY', version: 1, prompt: 'The denominator tells you how many equal parts make a whole.', options: [{ id: 'true', label: 'True' }, { id: 'false', label: 'False' }], correctAnswer: { kind: 'option', optionId: 'true' }, explanation: 'The bottom number counts the equal parts in one whole.', rubric: null, hints: [], media: null, authorOnly: false, successRate: null },
  { id: 'q-3', topicId: 'topic-parts', topicTitle: 'Parts of a whole', type: 'FILL_BLANK', difficulty: 'EASY', version: 1, prompt: 'In the fraction 3/8, the number 3 is the ___ and 8 is the ___.', options: null, correctAnswer: { kind: 'blanks', blanks: [['numerator'], ['denominator']] }, explanation: 'Top is numerator, bottom is denominator.', rubric: null, hints: [], media: null, authorOnly: false, successRate: { value: 0.64, attempts: 12 } },
  { id: 'q-4', topicId: 'topic-add', topicTitle: 'Adding fractions', type: 'MCQ', difficulty: 'MEDIUM', version: 3, prompt: 'What is 3/8 + 2/8?', options: opts('5/16', '5/8', '6/8', '1/8'), correctAnswer: { kind: 'option', optionId: 'o2' }, explanation: 'Add the numerators and keep the denominator.', rubric: null, hints: [{ rung: 'NUDGE', text: 'The bottom numbers match.' }, { rung: 'HINT', text: 'Add only the top numbers.' }], media: null, authorOnly: false, successRate: { value: 0.71, attempts: 58 } },
  { id: 'q-5', topicId: 'topic-add', topicTitle: 'Adding fractions', type: 'MULTI_SELECT', difficulty: 'MEDIUM', version: 1, prompt: 'Which of these sums equal 1 whole?', options: opts('1/2 + 1/2', '3/4 + 1/4', '2/5 + 2/5', '4/8 + 4/8'), correctAnswer: { kind: 'options', optionIds: ['o1', 'o2', 'o4'] }, explanation: 'Each correct sum has numerators that add to the denominator.', rubric: null, hints: [], media: null, authorOnly: false, successRate: null },
  { id: 'q-6', topicId: 'topic-add', topicTitle: 'Adding fractions', type: 'SHORT_ANSWER', difficulty: 'MEDIUM', version: 1, prompt: 'Explain in one sentence why the denominator stays the same when you add 2/9 + 4/9.', options: null, correctAnswer: { kind: 'text', sample: 'Because the pieces are the same size (ninths); we are only counting more of them.' }, explanation: 'The size of each piece does not change.', rubric: '1 mark for saying the pieces stay the same size; 1 mark for the idea of counting more pieces.', hints: [{ rung: 'HINT', text: 'Think about the size of each slice.' }], media: null, authorOnly: false, successRate: { value: 0.5, attempts: 8 } },
  { id: 'q-7', topicId: 'topic-add', topicTitle: 'Adding fractions', type: 'LONG_ANSWER', difficulty: 'HARD', version: 1, prompt: 'Maya says 1/4 + 1/4 = 2/8 because 1 + 1 = 2 and 4 + 4 = 8. Show what Maya got wrong and give the right answer with a drawing or number line.', options: null, correctAnswer: { kind: 'text', sample: '1/4 + 1/4 = 2/4 = 1/2. Maya added the denominators, but the size of the parts stays quarters.' }, explanation: 'Only the numerators are added.', rubric: '1 mark for the correct sum; 1 mark for identifying the error; 1 mark for a clear drawing or number line.', hints: [], media: null, authorOnly: false, successRate: null },
  { id: 'q-8', topicId: 'topic-compare', topicTitle: 'Comparing fractions', type: 'PICTURE_CHOICE', difficulty: 'EASY', version: 1, prompt: 'Which picture shows 1/2 shaded?', options: opts('Picture A', 'Picture B', 'Picture C'), correctAnswer: { kind: 'option', optionId: 'o2' }, explanation: 'Picture B has exactly one of two equal halves shaded.', rubric: null, hints: [], media: { optionImages: { o1: pic('a'), o2: pic('b'), o3: pic('c') } }, authorOnly: true, successRate: null },
  { id: 'q-9', topicId: 'topic-compare', topicTitle: 'Comparing fractions', type: 'ORDERING', difficulty: 'MEDIUM', version: 1, prompt: 'Put these fractions in order from smallest to largest.', options: opts('3/4', '1/4', '1/2', '7/8'), correctAnswer: { kind: 'order', optionIds: ['o2', 'o3', 'o1', 'o4'] }, explanation: '1/4 < 1/2 < 3/4 < 7/8.', rubric: null, hints: [], media: null, authorOnly: true, successRate: null },
  { id: 'q-10', topicId: 'topic-compare', topicTitle: 'Comparing fractions', type: 'MCQ', difficulty: 'HARD', version: 1, prompt: 'Which fraction is greater than 2/3?', options: opts('1/2', '3/5', '5/6', '4/9'), correctAnswer: { kind: 'option', optionId: 'o3' }, explanation: '5/6 = 0.83 and 2/3 = 0.67.', rubric: null, hints: [], media: null, authorOnly: false, successRate: { value: 0.35, attempts: 23 } },
  { id: 'q-11', topicId: 'topic-compare', topicTitle: 'Comparing fractions', type: 'CODE', difficulty: 'HARD', version: 1, prompt: 'Complete the function so it returns the larger of two fractions given as (numerator, denominator) pairs.', options: null, correctAnswer: { kind: 'code', sample: 'return a if a[0]*b[1] > b[0]*a[1] else b', language: 'python' }, explanation: 'Cross-multiply to compare.', rubric: null, hints: [], media: { language: 'python', starterCode: 'def larger(a, b):\n    # a and b are (numerator, denominator)\n    ...' }, authorOnly: true, successRate: null },
]
const questionById = (id: string) => FIXTURE_QUESTIONS.find(question => question.id === id)
const topicOrder = ['topic-parts', 'topic-add', 'topic-compare']
const diffOrder: Record<Difficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2 }
const swatch = (shaded: number) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="white" stroke="black" stroke-width="3"/><rect width="${160 * shaded}" height="100" fill="#444"/></svg>`)}`

interface Item { questionId: string; questionVersion: number; sortOrder: number; points: number }
interface Settings { showHints: boolean; answerLines: number; includeName: boolean }
interface Sheet { id: string; planId: string; title: string; instructions: string; targetBand: string; status: 'DRAFT' | 'FINAL' | 'ARCHIVED'; version: number; items: Item[]; settings: Settings; finalizedAt: string | null; createdAt: string; updatedAt: string }
interface ImportRow { rowNumber: number; cells: Record<string, string> }
interface ImportRecord { id: string; planId: string; fileName: string; headers: string[]; rows: ImportRow[]; status: 'UPLOADED' | 'MAPPED' | 'COMMITTED' | 'EXPIRED'; mapping: Record<string, string | null> | null; defaultTopicId: string | null; defaultType: string | null; preview: Json | null; committed: { committedCount: number; skippedCount: number; questionIds: string[] } | null; expiresAt: string }

export const SAMPLE_CSV = [
  'Type,Topic,Difficulty,Question,Option A,Option B,Option C,Option D,Answer,Explanation',
  'MCQ,Adding fractions,EASY,What is 1/5 + 2/5?,2/10,3/5,3/10,1/5,B,Add the tops and keep the bottom.',
  'TRUE_FALSE,Parts of a whole,EASY,A fraction with the same numerator and denominator equals one whole.,,,,,true,Because all parts are counted.',
  'MCQ,Adding fractions,MEDIUM,What is 3/8 + 2/8?,5/16,5/8,6/8,1/8,B,Duplicate of a question already in the bank.',
  'MCQ,Comparing fractions,EASY,,1/2,1/3,,,A,This row has no question text.',
  'CODE,Comparing fractions,HARD,Write a function that adds fractions.,,,,,print,Code questions cannot be imported.',
  'SHORT_ANSWER,Unknown topic name,MEDIUM,What does the numerator count?,,,,,The number of parts we have,No topic matches; the default topic is used.',
  'MCQ,Parts of a whole,EASY,Which fraction means half?,1/2,1/3,1/4,2/3,,Missing correct answer.',
].join('\n')

/** `state`: default, empty (no worksheets), denied, unavailable, slow (handled by the harness), expired (imports), conflict (first worksheet save). */
export function createMockWorksheets(state = 'default') {
  const plans = createMockTeaching('default')
  const sheets = new Map<string, Sheet>()
  const items = (ids: string[], points = 1): Item[] => ids.map((questionId, index) => ({ questionId, questionVersion: questionById(questionId)?.version ?? 1, sortOrder: index, points }))
  const defaults: Settings = { showHints: false, answerLines: 3, includeName: true }
  const make = (partial: Partial<Sheet> & Pick<Sheet, 'id' | 'title' | 'status'>): Sheet => ({ planId: 'plan-fractions', instructions: '', targetBand: '10-13', version: 1, items: [], settings: defaults, finalizedAt: null, createdAt: iso(-86_400_000), updatedAt: iso(-3_600_000), ...partial })
  if (state !== 'empty') {
    sheets.set('ws-final', make({ id: 'ws-final', title: 'Fractions check-in (fixture)', instructions: 'Answer every question. Show your working on the lines. You have 30 minutes.', status: 'FINAL', version: 3, finalizedAt: iso(-7_200_000), items: items(['q-1', 'q-2', 'q-3', 'q-4', 'q-5', 'q-8', 'q-9', 'q-6', 'q-7', 'q-11'], 2), settings: { showHints: true, answerLines: 3, includeName: true } }))
    sheets.set('ws-draft', make({ id: 'ws-draft', title: 'Adding fractions practice (fixture)', status: 'DRAFT', version: 2, items: items(['q-4', 'q-6']) }))
    sheets.set('ws-old', make({ id: 'ws-old', title: 'Old revision sheet (fixture)', status: 'ARCHIVED', version: 4, items: items(['q-1']) }))
  }
  const imports = new Map<string, ImportRecord>()
  const keys = new Map<string, MockResponse>()
  let counter = 0
  let firstSave = true
  const nextId = (prefix: string) => `${prefix}-${++counter}`
  const bankPrompts = () => new Set(FIXTURE_QUESTIONS.map(question => question.prompt.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()))
  const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

  /* ---------- CSV ---------- */
  function parseCsv(text: string): string[][] {
    const delimiter = (text.split(/\r?\n/)[0] ?? '').includes(';') && !(text.split(/\r?\n/)[0] ?? '').includes(',') ? ';' : ','
    const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
    const clean = text.replace(/^﻿/, '')
    for (let index = 0; index < clean.length; index += 1) {
      const char = clean[index]!
      if (quoted) { if (char === '"' && clean[index + 1] === '"') { cell += '"'; index += 1 } else if (char === '"') quoted = false; else cell += char }
      else if (char === '"') quoted = true
      else if (char === delimiter) { row.push(cell); cell = '' }
      else if (char === '\n' || char === '\r') { if (char === '\r' && clean[index + 1] === '\n') index += 1; row.push(cell); cell = ''; if (row.some(value => value.trim() !== '')) rows.push(row); row = [] }
      else cell += char
    }
    row.push(cell); if (row.some(value => value.trim() !== '')) rows.push(row)
    return rows
  }
  const suggest = (headers: string[]): Record<string, string | null> => {
    const alias: Record<string, string> = { question: 'prompt', answer: 'correct', 'correct answer': 'correct', 'option a': 'option_a', 'option b': 'option_b', 'option c': 'option_c', 'option d': 'option_d' }
    const out: Record<string, string | null> = {}
    for (const header of headers) { const key = header.trim().toLowerCase(); const field = alias[key] ?? key.replace(/\s+/g, '_'); out[field] = header }
    const fields = ['type', 'topic', 'difficulty', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'option_g', 'option_h', 'correct', 'explanation', 'hint_1', 'hint_2', 'hint_3', 'rubric']
    return Object.fromEntries(fields.map(field => [field, out[field] ?? null]))
  }
  function previewOf(record: ImportRecord): Json {
    const mapping = record.mapping ?? {}
    const cell = (row: ImportRow, field: string) => { const header = mapping[field]; return header ? (row.cells[header] ?? '').trim() : '' }
    const seen = new Map<string, number>(); const bank = bankPrompts()
    const rows = record.rows.map(row => {
      const errors: { field: string; code: string; message: string }[] = []
      const prompt = cell(row, 'prompt'); const type = (cell(row, 'type') || record.defaultType || 'MCQ').toUpperCase()
      const topicTitle = cell(row, 'topic')
      const topic = FIXTURE_QUESTIONS.find(question => question.topicTitle.toLowerCase() === topicTitle.toLowerCase())
      const topicId = topic?.topicId ?? record.defaultTopicId
      if (!prompt) errors.push({ field: 'prompt', code: 'REQUIRED', message: 'The question text is empty.' })
      if (!cell(row, 'correct')) errors.push({ field: 'correct', code: 'REQUIRED', message: 'No correct answer was given.' })
      if (type === 'CODE' || type === 'PICTURE_CHOICE') errors.push({ field: 'type', code: 'TYPE_NOT_IMPORTABLE', message: `${type === 'CODE' ? 'Code' : 'Picture choice'} questions cannot be imported. Write them in the editor.` })
      if (!topicId) errors.push({ field: 'topic', code: 'TOPIC_NOT_FOUND', message: `No topic called "${topicTitle || '(blank)'}" in this plan, and no default topic was chosen.` })
      let duplicateOf: { questionId: string | null; rowNumber: number | null } | null = null
      if (errors.length === 0) {
        const key = norm(prompt)
        const existing = FIXTURE_QUESTIONS.find(question => norm(question.prompt) === key)
        if (bank.has(key) && existing) duplicateOf = { questionId: existing.id, rowNumber: null }
        else if (seen.has(key)) duplicateOf = { questionId: null, rowNumber: seen.get(key)! }
        seen.set(key, row.rowNumber)
      }
      const status = errors.length > 0 ? 'INVALID' : duplicateOf ? 'DUPLICATE_SUGGESTION' : 'VALID'
      return { rowNumber: row.rowNumber, status, errors, duplicateOf, content: prompt || type ? { type, prompt, topicId: topicId ?? null, difficulty: cell(row, 'difficulty') || null } : null }
    })
    return { rows, validCount: rows.filter(row => row.status === 'VALID').length, invalidCount: rows.filter(row => row.status === 'INVALID').length }
  }
  const importOut = (record: ImportRecord) => ({ id: record.id, planId: record.planId, fileName: record.fileName, status: record.status, headers: record.headers, rowCount: record.rows.length, suggestedMapping: suggest(record.headers), mapping: record.mapping, defaultTopicId: record.defaultTopicId, defaultType: record.defaultType, preview: record.preview, result: record.committed, expiresAt: record.expiresAt })

  /* ---------- worksheets ---------- */
  const out = (sheet: Sheet) => ({ ...sheet, items: [...sheet.items].sort((a, b) => a.sortOrder - b.sortOrder) })
  function render(sheet: Sheet, part: 'student' | 'answer-key') {
    const sorted = [...sheet.items].sort((a, b) => a.sortOrder - b.sortOrder)
    return {
      worksheet: { id: sheet.id, title: sheet.title, instructions: sheet.instructions, status: sheet.status, settings: sheet.settings, planTitle: 'Grade 6 Fractions', version: sheet.version, finalizedAt: sheet.finalizedAt },
      items: sorted.map((item, index) => {
        const q = questionById(item.questionId)!
        const lines = q.type === 'SHORT_ANSWER' || q.type === 'LONG_ANSWER' || q.type === 'CODE' ? sheet.settings.answerLines : q.type === 'FILL_BLANK' ? 1 : 0
        const base = { number: index + 1, points: item.points, type: q.type, prompt: q.prompt, options: q.options, media: q.media, answerLines: lines, ...(sheet.settings.showHints && q.hints.length ? { hints: q.hints } : {}) }
        return part === 'student' ? base : { ...base, correctAnswer: q.correctAnswer, explanation: q.explanation, rubric: q.rubric }
      }),
    }
  }

  function handle(method: string, path: string, params: URLSearchParams, body?: Json, headers: Record<string, string> = {}): MockResponse {
    const idempotency = headers['Idempotency-Key']
    const cacheKey = idempotency ? `${method} ${path} ${idempotency}` : null
    if (cacheKey && keys.has(cacheKey)) return keys.get(cacheKey)!
    const done = (response: MockResponse) => { if (cacheKey && response.status < 400) keys.set(cacheKey, response); return response }

    if (state === 'denied' && (path.includes('/worksheets') || path.includes('/question-imports') || path.startsWith('/questions'))) return fail(403, 'NOT_TEACHING_SCOPE')
    if (state === 'unavailable' && (path.includes('/worksheets') || path.includes('/question-imports') || path.startsWith('/questions'))) return fail(503, 'TEACHING_UNAVAILABLE')

    // bank list (slice)
    if (method === 'GET' && path === '/questions') {
      const topicId = params.get('topicId'); const type = params.get('type'); const difficulty = params.get('difficulty'); const q = (params.get('q') ?? '').toLowerCase()
      const list = FIXTURE_QUESTIONS.filter(question => (!topicId || question.topicId === topicId) && (!type || question.type === type) && (!difficulty || question.difficulty === difficulty) && (!q || question.prompt.toLowerCase().includes(q)))
      const offset = Number(params.get('cursor') ?? 0); const page = list.slice(offset, offset + 6)
      return ok({ items: page.map(question => ({ id: question.id, planId: 'plan-fractions', topicId: question.topicId, topicTitle: question.topicTitle, type: question.type, difficulty: question.difficulty, status: 'PUBLISHED', version: question.version, promptPreview: question.prompt.slice(0, 160), authorOnly: question.authorOnly, successRate: question.successRate })), nextCursor: offset + 6 < list.length ? String(offset + 6) : null })
    }
    const material = path.match(/^\/plans\/[^/]+\/materials\/mat-img-([abc])\/download-url$/)
    if (method === 'GET' && material) return ok({ url: swatch(material[1] === 'a' ? 0.25 : material[1] === 'b' ? 0.5 : 0.75), expiresIn: 300 })

    // worksheets
    const planSheets = path.match(/^\/plans\/([^/]+)\/worksheets$/)
    if (planSheets && method === 'GET') return ok({ items: [...sheets.values()].map(out), nextCursor: null })
    if (planSheets && method === 'POST') {
      const sheet = make({ id: nextId('ws-new'), planId: planSheets[1]!, title: String(body?.title ?? ''), instructions: String(body?.instructions ?? ''), status: 'DRAFT', version: 1, createdAt: iso(), updatedAt: iso() })
      sheets.set(sheet.id, sheet); return done(ok({ worksheet: out(sheet) }, 201))
    }
    const one = path.match(/^\/worksheets\/([^/]+)(?:\/(fill|finalize|archive|render))?$/)
    if (one) {
      const sheet = sheets.get(one[1]!); if (!sheet) return fail(404, 'NOT_FOUND')
      const action = one[2]
      if (!action && method === 'PUT') {
        if (sheet.status !== 'DRAFT') return fail(409, 'WORKSHEET_NOT_DRAFT')
        if (state === 'conflict' && firstSave) { firstSave = false; return fail(409, 'VERSION_CONFLICT') }
        if (body?.expectedVersion !== sheet.version) return fail(409, 'VERSION_CONFLICT')
        const nextItems = (body.items as Item[]).map(entry => ({ ...entry })); if (new Set(nextItems.map(entry => entry.questionId)).size !== nextItems.length) return fail(400, 'VALIDATION')
        Object.assign(sheet, { title: body.title, instructions: body.instructions, items: nextItems, settings: body.settings, version: sheet.version + 1, updatedAt: iso() })
        return ok({ worksheet: out(sheet) })
      }
      if (!action && method === 'GET') {
        const detailed = out(sheet).items.map(item => {
          const q = questionById(item.questionId)
          return { ...item, promptPreview: q ? q.prompt.slice(0, 160) : '', type: q?.type ?? null, difficulty: q?.difficulty ?? null, topicTitle: q?.topicTitle ?? '', available: Boolean(q) }
        })
        return ok({ worksheet: { ...out(sheet), items: detailed } })
      }
      if (action === 'fill' && method === 'POST') {
        if (sheet.status !== 'DRAFT') return fail(409, 'WORKSHEET_NOT_DRAFT')
        const topicIds = (body?.topicIds as string[]) ?? []; const count = Number(body?.count ?? 0); const types = (body?.types as string[] | null) ?? null; const mix = (body?.mix as Partial<Record<Difficulty, number>> | null) ?? null
        const present = new Set(sheet.items.map(item => item.questionId))
        const pool = FIXTURE_QUESTIONS.filter(question => topicIds.includes(question.topicId) && !present.has(question.id) && (!types || types.includes(question.type)))
          .sort((a, b) => topicOrder.indexOf(a.topicId) - topicOrder.indexOf(b.topicId) || diffOrder[a.difficulty] - diffOrder[b.difficulty] || a.id.localeCompare(b.id))
        const picked = mix ? (['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).flatMap(level => pool.filter(question => question.difficulty === level).slice(0, mix[level] ?? 0)) : pool.slice(0, count)
        picked.forEach(question => sheet.items.push({ questionId: question.id, questionVersion: question.version, sortOrder: sheet.items.length, points: 1 }))
        sheet.version += 1
        return done(ok({ worksheet: out(sheet), shortfall: Math.max(0, count - picked.length) }))
      }
      if (action === 'finalize' && method === 'POST') { if (sheet.items.length === 0) return fail(400, 'VALIDATION'); sheet.status = 'FINAL'; sheet.finalizedAt = iso(); sheet.version += 1; return done(ok({ worksheet: out(sheet) })) }
      if (action === 'archive' && method === 'POST') { sheet.status = 'ARCHIVED'; sheet.version += 1; return done(ok({ worksheet: out(sheet) })) }
      if (action === 'render' && method === 'GET') return ok(render(sheet, params.get('part') === 'answer-key' ? 'answer-key' : 'student'))
    }

    // imports
    const upload = path.match(/^\/plans\/([^/]+)\/question-imports$/)
    if (upload && method === 'POST') {
      const text = String(body?.text ?? ''); const table = parseCsv(text)
      if (table.length < 2) return fail(422, 'VALIDATION')
      const headers = table[0]!.map(header => header.trim())
      const record: ImportRecord = { id: nextId('imp'), planId: upload[1]!, fileName: String(body?.fileName ?? 'questions.csv'), headers, rows: table.slice(1).map((cells, index) => ({ rowNumber: index + 1, cells: Object.fromEntries(headers.map((header, column) => [header, cells[column] ?? ''])) })), status: 'UPLOADED', mapping: null, defaultTopicId: null, defaultType: null, preview: null, committed: null, expiresAt: iso(86_400_000) }
      imports.set(record.id, record); return ok({ import: importOut(record) }, 201)
    }
    const imp = path.match(/^\/question-imports\/([^/]+)(?:\/(mapping|commit))?$/)
    if (imp) {
      const record = imports.get(imp[1]!); if (!record) return fail(404, 'NOT_FOUND')
      if (state === 'expired' && imp[2] === 'commit') { record.status = 'EXPIRED'; return fail(410, 'IMPORT_EXPIRED') }
      if (!imp[2] && method === 'GET') return ok({ import: importOut(record) })
      if (imp[2] === 'mapping' && method === 'PUT') {
        record.mapping = (body?.mapping as Record<string, string | null>) ?? {}; record.defaultTopicId = (body?.defaultTopicId as string | null) ?? null; record.defaultType = (body?.defaultType as string | null) ?? null
        record.preview = previewOf(record); record.status = 'MAPPED'; return ok({ preview: record.preview })
      }
      if (imp[2] === 'commit' && method === 'POST') {
        if (record.committed) return ok(record.committed)
        const preview = (record.preview ?? previewOf(record)) as { rows: { status: string; rowNumber: number }[] }
        const take = preview.rows.filter(row => row.status === 'VALID' || (row.status === 'DUPLICATE_SUGGESTION' && body?.includeDuplicateSuggestions === true))
        record.committed = { committedCount: take.length, skippedCount: preview.rows.length - take.length, questionIds: take.map(row => `q-imported-${record.id}-${row.rowNumber}`) }
        record.status = 'COMMITTED'; return ok(record.committed)
      }
    }
    return plans.handle(method, path, params, body, headers) as MockResponse
  }
  return { handle }
}
