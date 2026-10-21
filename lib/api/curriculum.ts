'use client'

import { getSession } from 'next-auth/react'
import { z } from 'zod'
import { ApiError } from './client'
import { platformApiBaseUrl } from './platform-client'

/**
 * B07 / S5 school-admin curriculum client. The wire shapes below are the platform's real DTOs
 * (`apps/api/src/modules/curriculum/curriculum.responses.ts`, `docs/api/curriculum.v1.openapi.json`), not guesses.
 * All paths are relative to `/schools/:schoolId` (see `schoolPath`) and sent by `curriculumRequest`.
 */
export const boards = ['CBSE', 'ICSE'] as const
export type CurriculumBoard = (typeof boards)[number]
export type CoverageStatus = 'COVERED' | 'PARTIAL' | 'NOT_LOADED'
export type AssignmentKind = 'PLAN' | 'MATERIAL' | 'CENTRAL_TOPIC'
export const assignmentKinds: readonly { value: AssignmentKind; label: string }[] = [
  { value: 'PLAN', label: 'Learning plan' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'CENTRAL_TOPIC', label: 'Central library topic' },
]

const id = z.string().min(1)
const board = z.enum(boards)
const count = z.number().int().nonnegative()
const nullableString = z.string().nullable()

/* ---------- GET /curriculum/coverage -> { rows, notice } ---------- */

export interface CoverageRow {
  board: CurriculumBoard; grade: number
  /** Null on the NOT_LOADED row of a board and class that has no published subject. */
  subjectKey: string | null; subjectName: string | null
  chapterCount: number; topicCount: number
  versionLabel: string | null; sourceTitle: string | null; reviewerName: string | null; reviewedAt: string | null
  status: CoverageStatus
}
export interface Coverage { rows: CoverageRow[]; notice: string }
export const coverageRowSchema = z.object({
  board, grade: z.number().int().min(1).max(10), subjectKey: nullableString, subjectName: nullableString,
  chapterCount: count, topicCount: count,
  versionLabel: nullableString, sourceTitle: nullableString, reviewerName: nullableString, reviewedAt: nullableString,
  status: z.enum(['COVERED', 'PARTIAL', 'NOT_LOADED']),
}) satisfies z.ZodType<CoverageRow>
export const coverageSchema = z.object({ rows: z.array(coverageRowSchema), notice: z.string() }) satisfies z.ZodType<Coverage>

/* ---------- GET /curriculum/catalog?board&grade -> { subjects, notice } ---------- */

export interface CatalogTopic { id: string; ordinal: number; title: string }
export interface CatalogChapter { id: string; ordinal: number; title: string; topics: CatalogTopic[] }
export interface CatalogVersion { id: string; label: string; sourceTitle: string; sourceUrl: string | null; reviewerName: string | null; reviewedAt: string | null; publishedAt: string | null }
export interface CatalogSubject {
  id: string; board: CurriculumBoard; grade: number; key: string; name: string; subjectId: string | null
  chapterCount: number; topicCount: number
  version: CatalogVersion
  /** Null unless both board and grade were requested; the web always requests both. */
  chapters: CatalogChapter[] | null
}
export interface Catalog { subjects: CatalogSubject[]; notice: string }
const topicSchema = z.object({ id, ordinal: z.number(), title: z.string() }) satisfies z.ZodType<CatalogTopic>
const versionSchema = z.object({ id, label: z.string(), sourceTitle: z.string(), sourceUrl: nullableString, reviewerName: nullableString, reviewedAt: nullableString, publishedAt: nullableString }) satisfies z.ZodType<CatalogVersion>
export const catalogSubjectSchema = z.object({
  id, board, grade: z.number().int().min(1).max(10), key: z.string(), name: z.string(), subjectId: nullableString,
  chapterCount: count, topicCount: count, version: versionSchema,
  chapters: z.array(z.object({ id, ordinal: z.number(), title: z.string(), topics: z.array(topicSchema) })).nullable(),
}) satisfies z.ZodType<CatalogSubject>
export const catalogSchema = z.object({ subjects: z.array(catalogSubjectSchema), notice: z.string() }) satisfies z.ZodType<Catalog>

/* ---------- GET|PUT /classes/:classId/subjects -> { class, items, available, notice } ---------- */

export interface MappedClassSubject {
  id: string; curriculumSubjectId: string; key: string; name: string; subjectId: string | null
  teacherUserId: string | null; teacherName: string | null; chapterCount: number; topicCount: number
  versionLabel: string; versionStatus: 'DRAFT' | 'REVIEWED' | 'PUBLISHED'
}
export interface AvailableClassSubject {
  curriculumSubjectId: string; key: string; name: string; subjectId: string | null
  chapterCount: number; topicCount: number; versionLabel: string; sourceTitle: string
}
export interface ClassSubjects {
  class: { id: string; schoolId: string; board: CurriculumBoard; grade: number; section: string; archived: boolean }
  items: MappedClassSubject[]
  /** Published subjects for the class board and grade: the only ones the server accepts in a mapping. */
  available: AvailableClassSubject[]
  notice: string
}
export const classSubjectsSchema = z.object({
  class: z.object({ id, schoolId: id, board, grade: z.number().int().min(1).max(10), section: z.string(), archived: z.boolean() }),
  items: z.array(z.object({
    id, curriculumSubjectId: id, key: z.string(), name: z.string(), subjectId: nullableString,
    teacherUserId: nullableString, teacherName: nullableString, chapterCount: count, topicCount: count,
    versionLabel: z.string(), versionStatus: z.enum(['DRAFT', 'REVIEWED', 'PUBLISHED']),
  })),
  available: z.array(z.object({
    curriculumSubjectId: id, key: z.string(), name: z.string(), subjectId: nullableString,
    chapterCount: count, topicCount: count, versionLabel: z.string(), sourceTitle: z.string(),
  })),
  notice: z.string(),
}) satisfies z.ZodType<ClassSubjects>
/** `teacherUserId` is optional; the server treats an omitted teacher as none. At most 30 subjects. */
export interface ClassSubjectsInput { subjects: { curriculumSubjectId: string; teacherUserId?: string }[] }

/* ---------- GET|POST|DELETE /classes/:classId/assignments ---------- */

export interface ClassAssignment {
  id: string; classId: string; kind: AssignmentKind; refId: string
  /** Null (with `available: false`) when the referenced content is no longer available. */
  title: string | null; available: boolean; dueAt: string | null; createdBy: string; createdAt: string
}
export interface ClassAssignmentPage { items: ClassAssignment[]; total: number; page: number; pageSize: number }
export const classAssignmentSchema = z.object({
  id, classId: id, kind: z.enum(['PLAN', 'MATERIAL', 'CENTRAL_TOPIC']), refId: id,
  title: nullableString, available: z.boolean(), dueAt: nullableString, createdBy: id, createdAt: z.string(),
}) satisfies z.ZodType<ClassAssignment>
export const classAssignmentsSchema = z.object({
  items: z.array(classAssignmentSchema), total: count, page: z.number().int().min(1), pageSize: z.number().int().min(1),
}) satisfies z.ZodType<ClassAssignmentPage>
export interface ClassAssignmentInput { kind: AssignmentKind; refId: string; dueAt?: string }
/** The platform requires a UUID for every kind: a published plan, a plan material or a published catalog topic. */
export const classAssignmentInputSchema = z.object({
  kind: z.enum(['PLAN', 'MATERIAL', 'CENTRAL_TOPIC']),
  refId: z.string().trim().uuid(),
  dueAt: z.string().datetime().optional(),
}).strict()

export const assignmentPageSize = 100
export const curriculumPaths = {
  catalog: (b: CurriculumBoard, g: number) => `/curriculum/catalog?board=${b}&grade=${g}`,
  coverage: () => '/curriculum/coverage',
  classSubjects: (classId: string) => `/classes/${encodeURIComponent(classId)}/subjects`,
  assignments: (classId: string) => `/classes/${encodeURIComponent(classId)}/assignments`,
  assignmentList: (classId: string) => `/classes/${encodeURIComponent(classId)}/assignments?page=1&pageSize=${assignmentPageSize}`,
  assignment: (classId: string, assignmentId: string) => `/classes/${encodeURIComponent(classId)}/assignments/${encodeURIComponent(assignmentId)}`,
}

/** Validate a school response at the boundary so a changed shape fails visibly, not as a crash. */
export function parseCurriculum<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) throw new ApiError(502, 'The curriculum service returned something we could not read. Please try again later.')
  return result.data
}

export const statusLabels: Record<CoverageStatus, string> = { COVERED: 'Covered', PARTIAL: 'Partial', NOT_LOADED: 'Not loaded' }
/** Local end of day for a date input, as an ISO instant. */
export const dueDateToIso = (value: string) => (value ? new Date(`${value}T23:59:00`).toISOString() : undefined)

/* ---------- transport ---------- */

/** A failure with the platform error `code` when it supplied one, so a screen can say exactly what was refused. */
export class CurriculumApiError extends ApiError {
  constructor(status: number, message: string, readonly code?: string) { super(status, message); this.name = 'CurriculumApiError' }
}

/** Contract error codes, with copy of our own (the server wording is never shown). */
export const curriculumCodeMessages: Record<string, string> = {
  ASSIGNMENT_REFERENCE_UNAVAILABLE: 'That plan, material or topic cannot be assigned. It must be published, belong to your school (or the reviewed central catalog) and match this class.',
  DUE_DATE_IN_PAST: 'The due date must be in the future.',
  CURRICULUM_SUBJECT_UNAVAILABLE: 'Choose a published curriculum subject.',
  CURRICULUM_SUBJECT_MISMATCH: 'A chosen subject belongs to a different board or class than this one.',
  TEACHER_UNAVAILABLE: 'Choose an active teacher of this school.',
  DUPLICATE_SUBJECT: 'A subject can be mapped only once for a class.',
}
const byStatus: Record<number, string> = {
  400: 'Check the supplied details and try again.',
  401: 'Your session has expired. Log in again.',
  403: 'You do not have permission for this school or action.',
  404: 'This class or assignment is not available in your school.',
  409: 'This action conflicts with the current record. Refresh and review before retrying.',
  429: 'Too many tries. Wait a moment, then try again.',
}
const unavailable = 'School services are unavailable. Your draft is still here; try again.'

/** `schoolRequest` discards the error body, so this reads the platform `code` for the S5 writes that can be refused for a reason. */
export async function curriculumRequest<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: unknown): Promise<T> {
  let session
  try { session = await getSession({ broadcast: false }) } catch { throw new CurriculumApiError(503, 'Your session could not be checked. Your draft is still here; try again.') }
  if (!session?.accessToken || !session.user?.id) throw new CurriculumApiError(401, byStatus[401]!)
  let response: Response
  try {
    response = await fetch(`${platformApiBaseUrl()}${path}`, {
      method,
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    })
  } catch { throw new CurriculumApiError(503, unavailable) }
  if (!response.ok) {
    const failure: unknown = await response.json().catch(() => null)
    const raw = failure && typeof failure === 'object' ? (failure as Record<string, unknown>).code : undefined
    const code = typeof raw === 'string' ? raw : undefined
    throw new CurriculumApiError(response.status, (code ? curriculumCodeMessages[code] : undefined) ?? byStatus[response.status] ?? unavailable, code)
  }
  if (response.status === 204) return undefined as T
  const json: unknown = await response.json().catch(() => { throw new CurriculumApiError(502, 'The curriculum service returned something we could not read. Please try again later.') })
  const record = json !== null && typeof json === 'object' ? json as Record<string, unknown> : null
  return (record && record.data !== undefined ? record.data : json) as T
}
