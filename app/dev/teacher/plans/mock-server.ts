import { lintLesson, lessonBands, newId, type LessonBand, type StudentLessonView, type TeacherLessonContent } from '@/lib/api/teaching/lesson-schema'
import type { PlanTreeNode } from '@/lib/api/teaching/plans'

/*
 * DEVELOPMENT FIXTURE ONLY. An in-memory stand-in for the B12 platform routes (P2/P3 are built in parallel), shaped exactly
 * like contract sections 6.1 to 6.10. Nothing here is a real platform response; the harness page says so on screen.
 */
export interface MockResponse { status: number; body?: unknown }
type Json = Record<string, unknown>
const iso = (offsetMs = 0) => new Date(Date.UTC(2026, 9, 22, 8, 0, 0) + offsetMs).toISOString()
const ok = (body: unknown, status = 200): MockResponse => ({ status, body: { statusCode: status, data: body, timestamp: iso() } })
const fail = (status: number, code: string, extra: Json = {}): MockResponse => ({ status, body: { statusCode: status, code, message: code, ...extra } })

export const FIXTURE_LESSON: TeacherLessonContent = {
  schemaVersion: '1.0', title: 'Adding fractions with the same bottom number', locale: 'en',
  objectives: ['Add two fractions that have the same denominator.', 'Explain why the denominator stays the same.'],
  keyTerms: [{ term: 'Denominator', definition: 'The bottom number. It tells how many equal parts make a whole.' }, { term: 'Numerator', definition: 'The top number. It tells how many parts we have.' }],
  steps: [
    { id: 'step-intro', kind: 'INTRO', title: 'Pizza slices', coLine: 'Let us share a pizza!', sources: [], check: null, blocks: [{ type: 'TEXT', text: 'A pizza is cut into 8 equal slices. You eat 3 slices and your friend eats 2 slices.' }] },
    { id: 'step-explain', kind: 'EXPLAIN', title: 'Add the tops, keep the bottom', coLine: null, check: null, sources: [{ materialId: 'mat-pdf', label: 'Mr. Thomas notes' }],
      blocks: [{ type: 'TEXT', text: 'When the bottom numbers match, you only add the top numbers. The bottom number tells the size of the slices, and the size does not change when you put slices together.' }, { type: 'LIST', items: ['Check the denominators match.', 'Add the numerators.', 'Keep the denominator.'] }] },
    { id: 'step-table', kind: 'EXAMPLE', title: 'Worked examples', coLine: null, sources: [], check: null, blocks: [{ type: 'TABLE', headers: ['Sum', 'Answer'], rows: [['1/8 + 2/8', '3/8'], ['3/8 + 3/8', '6/8']] }] },
    { id: 'step-check', kind: 'CHECK', title: 'Try one', coLine: null, sources: [], blocks: [{ type: 'TEXT', text: 'What is 3/8 + 2/8?' }],
      check: { question: 'What is 3/8 + 2/8?', hint: 'Add only the top numbers.', correctOptionId: 'opt-b', options: [{ id: 'opt-a', text: '5/16', feedback: 'The bottom number stays 8.' }, { id: 'opt-b', text: '5/8', feedback: 'Yes. The tops add up and the bottom stays 8.' }, { id: 'opt-c', text: '6/8', feedback: 'Count the slices again.' }] } },
    { id: 'step-recap', kind: 'RECAP', title: 'Remember', coLine: 'Tops add, bottoms stay.', sources: [], check: null, blocks: [{ type: 'TEXT', text: 'Same bottom number: add the top numbers and keep the bottom number.' }] },
  ],
}

interface Material { id: string; topicId: string; type: string; title: string; description: string | null; status: 'DRAFT' | 'PUBLISHED'; downloadable: boolean; visibility: 'PREVIEW' | 'SUBSCRIBER'; sortOrder: number; externalUrl: string | null; mimeType: string | null; sizeBytes: number | null; hasFile: boolean; createdAt: string; updatedAt: string }
interface LessonRow { variant: 'STANDARD' | 'EASIER' | 'HARDER'; version: number; status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED'; content: TeacherLessonContent; revision: number; updatedAt: string; publishedAt: string | null; sourceMaterialIds: string[] }
interface Assignment { id: string; classId: string; classLabel: string; dueAt: string | null; source: 'TEACHER' | 'SCHOOL_ADMIN'; createdAt: string; pending: number; active: number; already: number; skipped: number }
interface Plan { id: string; title: string; description: string | null; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; revision: number; classId: string; subject: string; band: LessonBand; origin: string; tree: PlanTreeNode[]; updatedAt: string; publishedAt: string | null; dueByTopic: Record<string, string | null>; assignments: Assignment[] }

const node = (id: string, kind: PlanTreeNode['kind'], title: string, children: PlanTreeNode[] = []): PlanTreeNode => ({ id, kind, title, description: null, sortOrder: 0, dueAt: null, prerequisiteTopicIds: [], counts: { materials: 0, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' }, children })
const renumber = (nodes: PlanTreeNode[]): PlanTreeNode[] => nodes.map((entry, index) => ({ ...entry, sortOrder: index, children: renumber(entry.children) }))
const flat = (nodes: PlanTreeNode[]): PlanTreeNode[] => nodes.flatMap(entry => [entry, ...flat(entry.children)])
const classes = [
  { classId: 'class-6a', label: 'CBSE · Class 6 A', board: 'CBSE', grade: 6, section: 'A', academicYear: '2026-27', rosterCount: 24,
    subjects: [{ subject: 'Mathematics', curriculumSubjectId: 'cs-math', curriculumStatus: 'COVERED' }, { subject: 'Science', curriculumSubjectId: null, curriculumStatus: 'NOT_LOADED' }] },
  { classId: 'class-6b', label: 'CBSE · Class 6 B', board: 'CBSE', grade: 6, section: 'B', academicYear: '2026-27', rosterCount: 22, subjects: [{ subject: 'Mathematics', curriculumSubjectId: 'cs-math', curriculumStatus: 'COVERED' }] },
  { classId: 'class-3a', label: 'CBSE · Class 3 A', board: 'CBSE', grade: 3, section: 'A', academicYear: '2026-27', rosterCount: 18, subjects: [{ subject: 'Mathematics', curriculumSubjectId: null, curriculumStatus: 'UNMAPPED' }] },
]
const bandFor = (grade: number): LessonBand => grade <= 4 ? '6-9' : grade <= 8 ? '10-13' : '14-17'

/** `state`: denied, unavailable, no-class, empty, conflict (first draft save), save-fail (first draft save), no-photo, no-curriculum. */
export function createMockTeaching(state = 'default') {
  const materials: Material[] = [
    { id: 'mat-pdf', topicId: 'topic-add', type: 'PDF', title: 'Mr. Thomas notes', description: null, status: 'PUBLISHED', downloadable: true, visibility: 'PREVIEW', sortOrder: 0, externalUrl: null, mimeType: 'application/pdf', sizeBytes: 2_400_000, hasFile: true, createdAt: iso(), updatedAt: iso() },
    { id: 'mat-video', topicId: 'topic-add', type: 'VIDEO_LINK', title: 'Fractions on the number line', description: null, status: 'PUBLISHED', downloadable: false, visibility: 'PREVIEW', sortOrder: 1, externalUrl: 'https://www.youtube.com/watch?v=fixture', mimeType: null, sizeBytes: null, hasFile: false, createdAt: iso(), updatedAt: iso() },
  ]
  const lessons = new Map<string, LessonRow[]>([['topic-add', [{ variant: 'STANDARD', version: 1, status: 'PUBLISHED', content: FIXTURE_LESSON, revision: 0, updatedAt: iso(), publishedAt: iso(), sourceMaterialIds: ['mat-pdf'] }]]])
  const questions = [{ id: 'q-1', type: 'MULTIPLE_CHOICE', status: 'PUBLISHED', promptPreview: 'Which fraction is bigger, 3/8 or 5/8?', materialIds: ['mat-pdf'] }, { id: 'q-2', type: 'SHORT_ANSWER', status: 'DRAFT', promptPreview: 'Explain why 1/4 is smaller than 1/2.', materialIds: [] }]
  const plans = new Map<string, Plan>()
  plans.set('plan-fractions', { id: 'plan-fractions', title: 'Grade 6 Fractions', description: 'Fractions for Class 6.', status: 'PUBLISHED', revision: 4, classId: 'class-6a', subject: 'Mathematics', band: '10-13', origin: 'SCRATCH', updatedAt: iso(-3_600_000), publishedAt: iso(-86_400_000), dueByTopic: { 'topic-add': iso(7 * 86_400_000) }, assignments: [],
    tree: renumber([node('phase-basics', 'module', 'Fraction basics', [node('topic-parts', 'topic', 'Parts of a whole'), node('topic-add', 'topic', 'Adding fractions', [node('sub-same', 'subtopic', 'Same denominator')])]), node('phase-more', 'module', 'Going further', [node('topic-compare', 'topic', 'Comparing fractions')])]) })
  plans.set('plan-algebra', { id: 'plan-algebra', title: 'Grade 6 Algebra Basics', description: null, status: 'DRAFT', revision: 2, classId: 'class-6a', subject: 'Mathematics', band: '10-13', origin: 'OUTLINE', updatedAt: iso(-7_200_000), publishedAt: null, dueByTopic: {}, assignments: [],
    tree: renumber([node('a-phase-1', 'module', 'Expressions', [node('a-topic-1', 'topic', 'Variables'), node('a-topic-2', 'topic', 'Simple equations')]), node('a-phase-2', 'module', 'Patterns', [])]) })
  if (state === 'empty') plans.clear()
  if (state === 'assigned' || state === 'admin-assignment') plans.get('plan-fractions')!.assignments.push({ id: 'asg-mine', classId: 'class-6a', classLabel: 'CBSE · Class 6 A', dueAt: iso(14 * 86_400_000), source: 'TEACHER', createdAt: iso(-3_600_000), pending: 19, active: 2, already: 2, skipped: 3 })
  const keys = new Map<string, MockResponse>()
  let flaky = state === 'conflict' || state === 'save-fail' || state === 'tree-fail'
  const enrolled = (plan: Plan) => plan.assignments.reduce((n, a) => n + a.active, 0)
  const pendingOf = (plan: Plan) => plan.assignments.reduce((n, a) => n + a.pending, 0)

  const lessonList = (topicId: string) => lessons.get(topicId) ?? []
  const summary = (row: LessonRow) => ({ variant: row.variant, version: row.version, status: row.status, title: row.content.title || 'Untitled lesson', stepCount: row.content.steps.length, origin: 'MANUAL', revision: row.revision, updatedAt: row.updatedAt, publishedAt: row.publishedAt, authoredByMe: true })
  const detail = (row: LessonRow, extra: Json = {}) => ({ ...summary(row), content: row.content, sourceMaterialIds: row.sourceMaterialIds, contentHash: `hash-${row.version}-${row.revision}`, ...extra })
  const withCounts = (plan: Plan): PlanTreeNode[] => {
    const walk = (nodes: PlanTreeNode[]): PlanTreeNode[] => nodes.map(entry => {
      const rows = lessonList(entry.id).filter(r => r.variant === 'STANDARD')
      const lesson: PlanTreeNode['counts']['lesson'] = rows.some(r => r.status === 'DRAFT') ? 'DRAFT' : rows.some(r => r.status === 'PUBLISHED') ? 'PUBLISHED' : 'NONE'
      return { ...entry, dueAt: plan.dueByTopic[entry.id] ?? null, counts: { materials: entry.kind === 'module' ? 0 : materials.filter(m => m.topicId === entry.id).length, publishedQuestions: entry.id === 'topic-add' ? 1 : 0, draftQuestions: entry.id === 'topic-add' ? 1 : 0, lesson }, children: walk(entry.children) }
    })
    return walk(plan.tree)
  }
  const card = (plan: Plan) => {
    const cls = classes.find(c => c.classId === plan.classId)!
    return { id: plan.id, title: plan.title, status: plan.status, scope: { classId: plan.classId, classLabel: cls.label, subject: plan.subject, curriculumSubjectId: 'cs-math', curriculumLabel: plan.origin === 'CURRICULUM' ? 'CBSE Mathematics' : null, targetBand: plan.band, origin: plan.origin },
      students: { roster: cls.rosterCount, enrolledActive: enrolled(plan), pendingGuardian: pendingOf(plan) }, averageProgress: plan.id === 'plan-fractions' ? 54 : null, topicCount: flat(plan.tree).filter(n => n.kind !== 'module').length, updatedAt: plan.updatedAt, publishedAt: plan.publishedAt }
  }
  const planDetail = (plan: Plan, extra: Json = {}) => {
    const tree = withCounts(plan)
    const topics = flat(tree).filter(n => n.kind !== 'module')
    const issues: { code: string; severity: 'ERROR' | 'WARNING'; nodeId: string | null; message: string }[] = []
    if (topics.length === 0) issues.push({ code: 'NO_TOPICS', severity: 'ERROR', nodeId: null, message: 'Add at least one topic before publishing.' })
    for (const entry of flat(tree)) if (!entry.title.trim()) issues.push({ code: 'EMPTY_TITLE', severity: 'ERROR', nodeId: entry.id, message: 'This item has no title.' })
    for (const topic of topics) {
      if (topic.counts.materials === 0 && topic.counts.lesson !== 'PUBLISHED') issues.push({ code: 'TOPIC_WITHOUT_CONTENT', severity: 'WARNING', nodeId: topic.id, message: 'This topic has no material or lesson yet.' })
      if (topic.counts.lesson === 'DRAFT') issues.push({ code: 'LESSON_DRAFT_UNPUBLISHED', severity: 'WARNING', nodeId: topic.id, message: 'The lesson is still a draft. Students will not see it until you publish it.' })
    }
    const cls = classes.find(c => c.classId === plan.classId)!
    const unknown = 2
    const visibility = plan.status !== 'PUBLISHED' ? 'NOT_PUBLISHED' : plan.assignments.length === 0 ? 'PUBLISHED_NOT_ASSIGNED' : enrolled(plan) > 0 ? 'ASSIGNED' : 'ASSIGNED_PENDING_APPROVAL'
    const byBand = { '6-9': 3, '10-13': cls.rosterCount - 3 - unknown - 4, '14-17': 4 }
    return { ...card(plan), description: plan.description, revision: plan.revision, tree, frozen: plan.status === 'PUBLISHED',
      eligibility: { targetBand: plan.band, defaultBandForGrade: bandFor(cls.grade), rosterByBand: byBand, unknownBand: unknown, outsideTarget: cls.rosterCount - unknown - byBand[plan.band], note: plan.band !== bandFor(cls.grade) ? `Most of this class is in a different band than ${plan.band}. This is only a note.` : null },
      readiness: { publishable: !issues.some(i => i.severity === 'ERROR'), issues },
      studentVisibility: { state: visibility, assignedClassIds: plan.assignments.map(a => a.classId) }, ...extra }
  }
  const rosterOf = (a: Assignment) => ({ total: classes.find(c => c.classId === a.classId)!.rosterCount, enrolledActive: a.active, pendingGuardian: a.pending, alreadyEnrolled: a.already, skipped: [{ count: a.skipped, reason: 'NO_ACCOUNT' }] })
  const assignmentOut = (planId: string, a: Assignment, extra: Json = {}) => ({ id: a.id, planId, classId: a.classId, classLabel: a.classLabel, dueAt: a.dueAt, source: a.source, createdAt: a.createdAt, roster: rosterOf(a), ...extra })
  const workspace = (plan: Plan, topic: PlanTreeNode, extra: Json = {}) => {
    const rows = lessonList(topic.id)
    const phase = plan.tree.find(p => flat([p]).some(n => n.id === topic.id))
    return { planId: plan.id, planStatus: plan.status, planRevision: plan.revision, frozen: plan.status === 'PUBLISHED',
      topic: { id: topic.id, title: topic.title, description: null, dueAt: plan.dueByTopic[topic.id] ?? null, parentTopicId: null, phaseTitle: phase?.title ?? null },
      materials: materials.filter(m => m.topicId === topic.id).sort((a, b) => a.sortOrder - b.sortOrder), questions: topic.id === 'topic-add' ? questions : [],
      lesson: { draft: rows.filter(r => r.status === 'DRAFT').map(summary)[0] ?? null, published: rows.filter(r => r.status === 'PUBLISHED').map(summary)[0] ?? null, versions: rows.map(summary) },
      ai: { generateLesson: unavailable(), generateWorksheet: unavailable(), differentiate: unavailable() }, worksheet: { available: false, reason: 'Worksheet export arrives in a later release.' }, ...extra }
  }
  const unavailable = () => ({ status: 'UNAVAILABLE', code: 'TEACHER_AI_NOT_INSTALLED', reason: 'Co drafting for teachers is not available yet.' })
  const view = (content: TeacherLessonContent): StudentLessonView => ({
    schemaVersion: '1.0', title: content.title, objectives: content.objectives, keyTerms: content.keyTerms, locale: 'en',
    steps: content.steps.map(step => ({ id: step.id, kind: step.kind, title: step.title, coLine: step.coLine, blocks: step.blocks, sources: step.sources.filter(s => materials.find(m => m.id === s.materialId)?.status === 'PUBLISHED'),
      check: step.check ? { question: step.check.question, options: step.check.options.map(o => ({ id: o.id, text: o.text })), hint: step.check.hint } : null })),
  })
  const bump = (plan: Plan) => { plan.revision += 1; plan.updatedAt = new Date().toISOString() }

  function handle(method: string, rawPath: string, query: URLSearchParams, body: Json | undefined, headers: Record<string, string>): MockResponse {
    const path = rawPath.replace(/\/+$/, '')
    const key = headers['Idempotency-Key']
    if (state === 'unavailable') return fail(503, 'TEACHING_UNAVAILABLE')
    if (state === 'denied' && path !== '/context') return fail(403, 'FORBIDDEN')
    let m: RegExpMatchArray | null
    if (method === 'GET' && path === '/context') {
      return ok({ school: { id: 'school-1', name: 'Green Valley School' }, teacher: { userId: 'teacher-1', displayName: 'Ms. Rao' }, classes: state === 'no-class' ? [] : classes.map(c => ({ ...c, subjects: state === 'no-curriculum' ? c.subjects.map(s => ({ ...s, curriculumStatus: 'NOT_LOADED' })) : c.subjects })),
        features: { aiDrafting: { draftPlan: unavailable(), generateLesson: unavailable(), generateWorksheet: unavailable(), differentiate: unavailable() }, curriculumSource: { available: state !== 'no-curriculum', reason: state === 'no-curriculum' ? 'No curriculum has been loaded for your classes yet.' : null }, outlineSource: { available: true }, syllabusUpload: { available: false, reason: 'Reading an uploaded syllabus needs Co, which is not available yet.' }, photoUpload: { available: state !== 'no-photo', reason: state === 'no-photo' ? 'File storage is not set up for your school yet.' : null }, studentAssignment: { available: true, reason: null }, inviteStudents: { available: false, reason: 'Invite codes arrive in a later release.' }, worksheetExport: { available: false, reason: 'Worksheet export arrives in a later release.' } } })
    }
    if (method === 'GET' && path === '/plans') {
      const status = query.get('status'); const classId = query.get('classId'); const q = (query.get('q') ?? '').toLowerCase()
      const all = [...plans.values()]
      const items = all.filter(p => (!status || p.status === status) && (!classId || p.classId === classId) && (!q || p.title.toLowerCase().includes(q))).map(card)
      return ok({ items, nextCursor: null, counts: { draft: all.filter(p => p.status === 'DRAFT').length, published: all.filter(p => p.status === 'PUBLISHED').length, archived: all.filter(p => p.status === 'ARCHIVED').length } })
    }
    if (method === 'POST' && path === '/plans') {
      if (key && keys.has(key)) return keys.get(key)!
      const b = body as { title: string; description?: string; classId: string; subject: string; targetBand?: LessonBand; source: { kind: string; text?: string } }
      if (b.source.kind === 'AI_DRAFT') return fail(409, 'TEACHER_AI_UNAVAILABLE')
      if (b.source.kind === 'CURRICULUM' && state === 'no-curriculum') return fail(409, 'CURRICULUM_NOT_LOADED')
      if (!classes.some(c => c.classId === b.classId)) return fail(403, 'CLASS_NOT_ASSIGNED')
      const cls = classes.find(c => c.classId === b.classId)!
      let tree: PlanTreeNode[] = []
      if (b.source.kind === 'OUTLINE') {
        for (const line of (b.source.text ?? '').split('\n')) { if (!line.trim()) continue; if (/^\s+\S|^\s*[-*]\s/.test(line)) tree[tree.length - 1]?.children.push(node(newId(), 'topic', line.replace(/^\s*[-*]?\s*/, ''))); else tree.push(node(newId(), 'module', line.trim())) }
      } else if (b.source.kind === 'CURRICULUM') tree = [node(newId(), 'module', 'Chapter 1: Fractions', [node(newId(), 'topic', 'Fractions on a number line')])]
      const plan: Plan = { id: `plan-${newId().slice(0, 8)}`, title: b.title, description: b.description ?? null, status: 'DRAFT', revision: 0, classId: b.classId, subject: b.subject, band: b.targetBand ?? bandFor(cls.grade), origin: b.source.kind, tree: renumber(tree), updatedAt: new Date().toISOString(), publishedAt: null, dueByTopic: {}, assignments: [] }
      plans.set(plan.id, plan)
      const response = ok(planDetail(plan), 201)
      if (key) keys.set(key, ok(planDetail(plan), 200))
      return response
    }
    if ((m = path.match(/^\/plans\/([^/]+)$/))) {
      const plan = plans.get(m[1]!); if (!plan) return fail(404, 'PLAN_NOT_FOUND')
      if (method === 'GET') return ok(planDetail(plan))
      if (method === 'PATCH') {
        const b = body as { expectedRevision: number; title?: string; description?: string; targetBand?: LessonBand }
        if (b.expectedRevision !== plan.revision) return fail(409, 'REVISION_CONFLICT', { currentRevision: plan.revision })
        if (b.title !== undefined) { if (plan.status === 'PUBLISHED') return fail(409, 'PLAN_STRUCTURE_FROZEN'); plan.title = b.title }
        if (b.description !== undefined) plan.description = b.description
        if (b.targetBand) plan.band = b.targetBand
        bump(plan); return ok(planDetail(plan))
      }
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/tree$/)) && method === 'PUT') {
      const plan = plans.get(m[1]!); if (!plan) return fail(404, 'PLAN_NOT_FOUND')
      const b = body as { expectedRevision: number; tree: { id: string; kind: PlanTreeNode['kind']; title: string; children: unknown[] }[]; confirmRemoveNodeIds?: string[] }
      if (plan.status === 'PUBLISHED') return fail(409, 'PLAN_STRUCTURE_FROZEN')
      if (b.expectedRevision !== plan.revision) return fail(409, 'REVISION_CONFLICT', { currentRevision: plan.revision })
      if (state === 'tree-fail' && flaky) { flaky = false; return fail(503, 'TEACHING_UNAVAILABLE') }
      const convert = (entries: typeof b.tree): PlanTreeNode[] => entries.map(entry => { const old = flat(plan.tree).find(n => n.id === entry.id); return { ...(old ?? node(entry.id, entry.kind, entry.title)), id: entry.id, kind: entry.kind, title: entry.title, children: convert(entry.children as typeof b.tree) } })
      plan.tree = renumber(convert(b.tree)); bump(plan); return ok(planDetail(plan))
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/(publish|unpublish|archive)$/)) && method === 'POST') {
      const plan = plans.get(m[1]!); if (!plan) return fail(404, 'PLAN_NOT_FOUND')
      const action = m[2]!; const b = body as { expectedRevision: number }
      if (key && keys.has(`${plan.id}:${action}:${key}`)) return keys.get(`${plan.id}:${action}:${key}`)!
      if (b.expectedRevision !== plan.revision) return fail(409, 'REVISION_CONFLICT', { currentRevision: plan.revision })
      let changed = true
      if (action === 'publish') { if (plan.status === 'PUBLISHED') changed = false; else { if (!planDetail(plan).readiness.publishable) return fail(422, 'PLAN_NOT_READY'); plan.status = 'PUBLISHED'; plan.publishedAt = new Date().toISOString(); for (const mat of materials) mat.status = 'PUBLISHED'; bump(plan) } }
      else if (enrolled(plan) + pendingOf(plan) > 0 || plan.assignments.length > 0) return fail(409, 'PLAN_IN_USE')
      else if (action === 'unpublish') { plan.status = 'DRAFT'; plan.publishedAt = null; bump(plan) } else { plan.status = 'ARCHIVED'; bump(plan) }
      const response = ok(planDetail(plan, { changed })); if (key) keys.set(`${plan.id}:${action}:${key}`, ok(planDetail(plan, { changed: false })))
      return response
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/topics\/([^/]+)$/))) {
      const plan = plans.get(m[1]!); const topic = plan && flat(plan.tree).find(n => n.id === m![2] && n.kind !== 'module'); if (!plan || !topic) return fail(404, 'PLAN_NOT_FOUND')
      if (method === 'GET') return ok(workspace(plan, topic))
      if (method === 'PATCH') {
        const b = body as { expectedRevision: number; dueAt?: string | null }
        if (b.expectedRevision !== plan.revision) return fail(409, 'REVISION_CONFLICT', { currentRevision: plan.revision })
        if (b.dueAt !== undefined) plan.dueByTopic[topic.id] = b.dueAt
        bump(plan)
        return ok(workspace(plan, topic, b.dueAt && new Date(b.dueAt).getTime() < Date.UTC(2026, 9, 22) ? { warnings: ['That date is in the past. It was saved as you entered it.'] } : {}))
      }
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/topics\/([^/]+)\/materials\/upload-url$/)) && method === 'POST') {
      const b = body as { filename: string }
      return ok({ uploadUrl: `${typeof window === 'undefined' ? '' : window.location.origin}/dev/teacher/plans/upload-sink`, storageKey: `plan-materials/org/${m[1]}/${m[2]}/${newId()}-${b.filename}`, expiresIn: 300 })
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/topics\/([^/]+)\/materials$/)) && method === 'POST') {
      const plan = plans.get(m[1]!); if (!plan) return fail(404, 'PLAN_NOT_FOUND')
      if (key && keys.has(key)) return keys.get(key)!
      const b = body as Partial<Material> & { storageKey?: string }
      const row: Material = { id: `mat-${newId().slice(0, 8)}`, topicId: m[2]!, type: b.type ?? 'PDF', title: b.title ?? 'Untitled', description: b.description ?? null, status: plan.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED', downloadable: false, visibility: 'PREVIEW', sortOrder: materials.filter(x => x.topicId === m![2]).length, externalUrl: b.externalUrl ?? null, mimeType: b.mimeType ?? null, sizeBytes: b.sizeBytes ?? null, hasFile: !!b.storageKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      materials.push(row); const response = ok(row, 201); if (key) keys.set(key, response); return response
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/topics\/([^/]+)\/materials\/reorder$/)) && method === 'POST') {
      for (const item of (body as { items: { id: string; sortOrder: number }[] }).items) { const row = materials.find(x => x.id === item.id); if (row) row.sortOrder = item.sortOrder }
      return ok({ items: materials.filter(x => x.topicId === m![2]).sort((a, b) => a.sortOrder - b.sortOrder) })
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/materials\/([^/]+)(\/publish|\/download-url)?$/))) {
      const row = materials.find(x => x.id === m![2]); if (!row) return fail(404, 'PLAN_NOT_FOUND')
      if (m[3] === '/download-url') return ok({ url: 'https://example.invalid/fixture.pdf', expiresIn: 300 })
      if (m[3] === '/publish' && method === 'POST') { row.status = 'PUBLISHED'; return ok(row) }
      if (method === 'PATCH') { Object.assign(row, body); return ok(row) }
      if (method === 'DELETE') {
        const inDraft = lessonList(row.topicId).some(l => l.status === 'DRAFT' && l.sourceMaterialIds.includes(row.id))
        if (inDraft) return fail(409, 'MATERIAL_IN_USE')
        materials.splice(materials.indexOf(row), 1); return { status: 204 }
      }
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/questions\/([^/]+)\/materials$/)) && method === 'PUT') {
      const q = questions.find(x => x.id === m![2]); if (!q) return fail(404, 'PLAN_NOT_FOUND'); q.materialIds = (body as { materialIds: string[] }).materialIds; return ok(q)
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/topics\/([^/]+)\/lessons(?:\/(draft\/publish|draft\/duplicate-as|draft|\d+(?:\/preview)?))?$/))) {
      const topicId = m[2]!; const tail = m[3]; const variant = (query.get('variant') ?? 'STANDARD') as LessonRow['variant']; const rows = lessons.get(topicId) ?? []
      if (!tail && method === 'GET') return ok({ versions: rows.map(summary) })
      if (tail === 'draft' && method === 'PUT') {
        const b = body as { expectedRevision: number | null; baseVersion?: number; content: TeacherLessonContent; sourceMaterialIds?: string[] }
        if (flaky && state === 'conflict' && b.expectedRevision !== null) { flaky = false; return fail(409, 'REVISION_CONFLICT', { currentRevision: (b.expectedRevision ?? 0) + 3 }) }
        if (flaky && state === 'save-fail') { flaky = false; return fail(503, 'TEACHING_UNAVAILABLE') }
        const draft = rows.find(r => r.variant === variant && r.status === 'DRAFT')
        if (b.expectedRevision === null) {
          if (draft) return fail(409, 'REVISION_CONFLICT', { currentRevision: draft.revision })
          const version = Math.max(0, ...rows.filter(r => r.variant === variant).map(r => r.version)) + 1
          const row: LessonRow = { variant, version, status: 'DRAFT', content: b.content, revision: 0, updatedAt: new Date().toISOString(), publishedAt: null, sourceMaterialIds: b.sourceMaterialIds ?? [] }
          lessons.set(topicId, [...rows, row]); return ok(detail(row))
        }
        if (!draft) return fail(404, 'PLAN_NOT_FOUND')
        if (draft.revision !== b.expectedRevision) return fail(409, 'REVISION_CONFLICT', { currentRevision: draft.revision })
        if (JSON.stringify(draft.content) !== JSON.stringify(b.content)) { draft.content = b.content; draft.revision += 1; draft.updatedAt = new Date().toISOString(); draft.sourceMaterialIds = b.sourceMaterialIds ?? [] }
        return ok(detail(draft))
      }
      if (tail === 'draft' && method === 'DELETE') { lessons.set(topicId, rows.filter(r => !(r.variant === variant && r.status === 'DRAFT'))); return { status: 204 } }
      if (tail === 'draft/publish' && method === 'POST') {
        const draft = rows.find(r => r.variant === variant && r.status === 'DRAFT')
        if (!draft) { const published = rows.find(r => r.variant === variant && r.status === 'PUBLISHED'); return published ? ok(detail(published, { changed: false })) : fail(404, 'PLAN_NOT_FOUND') }
        if (draft.revision !== (body as { expectedRevision: number }).expectedRevision) return fail(409, 'REVISION_CONFLICT', { currentRevision: draft.revision })
        for (const r of rows) if (r.variant === variant && r.status === 'PUBLISHED') r.status = 'SUPERSEDED'
        draft.status = 'PUBLISHED'; draft.publishedAt = new Date().toISOString(); return ok(detail(draft, { changed: true }))
      }
      if (tail === 'draft/duplicate-as' && method === 'POST') {
        const b = body as { variant: 'EASIER' | 'HARDER'; fromVersion?: number }
        const from = rows.filter(r => r.variant === 'STANDARD').sort((x, y) => y.version - x.version)[0]; if (!from) return fail(404, 'PLAN_NOT_FOUND')
        const row: LessonRow = { variant: b.variant, version: Math.max(0, ...rows.filter(r => r.variant === b.variant).map(r => r.version)) + 1, status: 'DRAFT', content: from.content, revision: 0, updatedAt: new Date().toISOString(), publishedAt: null, sourceMaterialIds: from.sourceMaterialIds }
        lessons.set(topicId, [...rows, row]); return ok(detail(row), 201)
      }
      const versionMatch = tail?.match(/^(\d+)(\/preview)?$/)
      if (versionMatch && method === 'GET') {
        const row = rows.find(r => r.variant === variant && r.version === Number(versionMatch[1])); if (!row) return fail(404, 'PLAN_NOT_FOUND')
        if (!versionMatch[2]) return ok(detail(row))
        const band = (query.get('band') ?? '10-13') as LessonBand
        const bandFit = lessonBands.map(b => { const issues = lintLesson(row.content, b); return { band: b, ok: issues.length === 0, issues: issues.map(i => ({ path: i.path, rule: i.rule, message: i.message })) } })
        return ok({ band, view: view(row.content), bandFit })
      }
    }
    if ((m = path.match(/^\/plans\/([^/]+)\/assignments(?:\/([^/]+)(\/sync)?)?$/))) {
      const plan = plans.get(m[1]!); if (!plan) return fail(404, 'PLAN_NOT_FOUND')
      const id = m[2]
      if (!id && method === 'GET') return ok({ items: plan.assignments.map(a => assignmentOut(plan.id, a)) })
      if (!id && method === 'POST') {
        if (plan.status !== 'PUBLISHED') return fail(409, 'PLAN_NOT_PUBLISHED')
        const b = body as { classId: string; dueAt?: string | null }
        const cls = classes.find(c => c.classId === b.classId); if (!cls || !cls.subjects.some(s => s.subject === plan.subject)) return fail(403, 'CLASS_NOT_ASSIGNED')
        const existing = plan.assignments.find(a => a.classId === b.classId)
        if (existing) return ok(assignmentOut(plan.id, existing, { changed: false }))
        const skipped = 3; const already = 2
        const a: Assignment = { id: `asg-${newId().slice(0, 8)}`, classId: cls.classId, classLabel: cls.label, dueAt: b.dueAt ?? null, source: 'TEACHER', createdAt: new Date().toISOString(), pending: cls.rosterCount - skipped - already, active: already, already, skipped }
        plan.assignments.push(a); return ok(assignmentOut(plan.id, a), 201)
      }
      const target = plan.assignments.find(a => a.id === id); if (!target) return method === 'DELETE' ? ok({ removed: false, revoked: 0, retained: 0 }) : fail(404, 'PLAN_NOT_FOUND')
      if (m[3] && method === 'POST') { target.pending += 1; return ok(assignmentOut(plan.id, target)) }
      if (method === 'PATCH') { target.dueAt = (body as { dueAt: string | null }).dueAt; return ok(assignmentOut(plan.id, target)) }
      if (method === 'DELETE') { if (target.source === 'SCHOOL_ADMIN') return fail(403, 'ASSIGNMENT_NOT_OWNED'); plan.assignments = plan.assignments.filter(a => a.id !== id); return ok({ removed: true, revoked: target.pending + target.active - 1, retained: 1 }) }
    }
    return fail(404, 'NOT_FOUND')
  }

  /** Adds an admin-created assignment so the read-only row can be shown. */
  function seedAdminAssignment() { const plan = plans.get('plan-fractions')!; plan.assignments.push({ id: 'asg-admin', classId: 'class-6b', classLabel: 'CBSE · Class 6 B', dueAt: null, source: 'SCHOOL_ADMIN', createdAt: iso(-86_400_000), pending: 18, active: 1, already: 0, skipped: 3 }) }
  if (state === 'admin-assignment') seedAdminAssignment()
  return { handle, plans, view, materials }
}
export type MockTeaching = ReturnType<typeof createMockTeaching>
