import { z } from 'zod/v4'
import type { TeachingRequestFn } from './core'
import { draftToPayload, teacherProfileSchema, type ProfileDraft } from './profile'

/** B12 section 6.8. */
export const onboardingStepSchema = z.enum(['PROFILE', 'FIRST_PLAN', 'MATERIAL', 'INVITE', 'DONE'])
export type TeacherOnboardingStep = z.infer<typeof onboardingStepSchema>
export const ONBOARDING_STEPS: TeacherOnboardingStep[] = ['PROFILE', 'FIRST_PLAN', 'MATERIAL', 'INVITE', 'DONE']

export const studentVisibilitySchema = z.enum([
  'NOT_PUBLISHED',
  'PUBLISHED_NOT_ASSIGNED',
  'ASSIGNED_PENDING_APPROVAL',
  'ASSIGNED',
])
export type StudentVisibility = z.infer<typeof studentVisibilitySchema>

const availability = z.object({ available: z.boolean(), reason: z.string().nullable() })

export const teacherOnboardingStateSchema = z.object({
  step: onboardingStepSchema,
  completed: z.boolean(),
  revision: z.number(),
  skipped: z.array(z.enum(['MATERIAL', 'INVITE'])),
  skippable: z.object({ MATERIAL: z.boolean(), INVITE: z.boolean() }),
  profile: teacherProfileSchema,
  activation: z.object({
    membership: z.literal('ACTIVE'),
    classesAssigned: z.number(),
    note: z.string().nullable(),
  }),
  firstPlan: z
    .object({
      planId: z.string(),
      title: z.string(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
      publishedAt: z.string().nullable(),
      studentVisibility: studentVisibilitySchema,
    })
    .nullable(),
  hasMaterial: z.boolean(),
  assign: z.object({
    available: z.boolean(),
    reason: z.string().nullable(),
    rosterCount: z.number().nullable(),
  }),
  invite: z.object({ available: z.literal(false), reason: z.string() }),
  photoUpload: availability,
})
export type TeacherOnboardingState = z.infer<typeof teacherOnboardingStateSchema>

export const onboardingCompleteSchema = z.object({
  nextRoute: z.string(),
  state: teacherOnboardingStateSchema,
})
export type OnboardingComplete = z.infer<typeof onboardingCompleteSchema>

export const photoUploadUrlSchema = z.object({
  uploadUrl: z.string(),
  storageKey: z.string(),
  expiresIn: z.number(),
})
export type PhotoUploadUrl = z.infer<typeof photoUploadUrlSchema>

export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024

/** Whole-step Done copy. "Live" is only ever claimed at ASSIGNED (F-T8-06). */
export const DONE_COPY: Record<StudentVisibility, { title: string; body: string }> = {
  NOT_PUBLISHED: {
    title: 'Your plan is saved as a draft',
    body: 'Students cannot see it yet. Finish it and publish from the plan editor when you are ready.',
  },
  PUBLISHED_NOT_ASSIGNED: {
    title: 'Published. Students will see it once you assign it to a class',
    body: 'Assign the plan to a class from the plan editor so your students can start.',
  },
  ASSIGNED_PENDING_APPROVAL: {
    title: 'Assigned. Students appear once their guardians approve',
    body: 'Learners under 18 need a guardian to approve first. You will see them as soon as they are approved.',
  },
  ASSIGNED: {
    title: 'Your plan is live',
    body: 'At least one student can already open it.',
  },
}

export function doneCopy(state: Pick<TeacherOnboardingState, 'firstPlan'>) {
  return state.firstPlan ? DONE_COPY[state.firstPlan.studentVisibility] : DONE_COPY.NOT_PUBLISHED
}

/** Forward-only: never show a step the server has not unlocked, never go back past the saved step. */
export function stepIndex(step: TeacherOnboardingStep) {
  return ONBOARDING_STEPS.indexOf(step)
}
export function resolveViewedStep(saved: TeacherOnboardingStep, requested: string | null | undefined): TeacherOnboardingStep {
  const parsed = onboardingStepSchema.safeParse(requested?.toUpperCase().replace('-', '_'))
  if (!parsed.success) return saved
  return stepIndex(parsed.data) <= stepIndex(saved) ? parsed.data : saved
}

/* ---- requests (parse every response; callers pass `useTeaching().request`) ---- */
const asState = (raw: unknown): TeacherOnboardingState => {
  const direct = teacherOnboardingStateSchema.safeParse(raw)
  if (direct.success) return direct.data
  return teacherOnboardingStateSchema.parse((raw as { state?: unknown } | null)?.state)
}

export const parseOnboardingState = (raw: unknown) => teacherOnboardingStateSchema.parse(raw)

export async function saveOnboarding(
  request: TeachingRequestFn,
  state: Pick<TeacherOnboardingState, 'revision'>,
  change: { step?: TeacherOnboardingStep; profile?: ReturnType<typeof draftToPayload> & { photoStorageKey?: string | null } },
) {
  return asState(await request<unknown>('/onboarding', 'PUT', { expectedRevision: state.revision, ...change }))
}

export async function saveProfileStep(request: TeachingRequestFn, state: Pick<TeacherOnboardingState, 'revision'>, draft: ProfileDraft, photoStorageKey: string | null) {
  return saveOnboarding(request, state, {
    step: 'FIRST_PLAN',
    profile: { ...draftToPayload(draft), photoStorageKey },
  })
}

export async function skipOnboardingStep(request: TeachingRequestFn, state: Pick<TeacherOnboardingState, 'revision'>, step: 'MATERIAL' | 'INVITE') {
  return asState(await request<unknown>('/onboarding/skip', 'POST', { step, expectedRevision: state.revision }))
}

export async function completeOnboarding(request: TeachingRequestFn, state: Pick<TeacherOnboardingState, 'revision'>) {
  return onboardingCompleteSchema.parse(await request<unknown>('/onboarding/complete', 'POST', { expectedRevision: state.revision }))
}

export async function requestPhotoUpload(request: TeachingRequestFn, file: { type: string; size: number }) {
  return photoUploadUrlSchema.parse(
    await request<unknown>('/onboarding/photo-upload-url', 'POST', { mimeType: file.type, sizeBytes: file.size }),
  )
}

export function validatePhoto(file: { type: string; size: number }): string | null {
  if (!(PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return 'Use a JPEG, PNG or WebP photo.'
  if (file.size > PHOTO_MAX_BYTES) return 'Photos can be 2 MB at most.'
  return null
}

/* ---- the first topic of the first plan, for the Material step ---- */
export interface FirstTopic { planId: string; topicId: string; title: string }
type TreeNode = { id: string; kind: string; title: string; children?: TreeNode[] }
const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({ id: z.string(), kind: z.string(), title: z.string(), children: z.array(treeNodeSchema).optional() }),
)
export const planForMaterialSchema = z.object({ id: z.string(), status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']), tree: z.array(treeNodeSchema) })

export function firstTopicOf(plan: z.infer<typeof planForMaterialSchema>): FirstTopic | null {
  const walk = (nodes: TreeNode[]): TreeNode | null => {
    for (const node of nodes) {
      if (node.kind !== 'module') return node
      const inner = walk(node.children ?? [])
      if (inner) return inner
    }
    return null
  }
  const topic = walk(plan.tree)
  return topic ? { planId: plan.id, topicId: topic.id, title: topic.title } : null
}

export type MaterialDraft =
  | { kind: 'LINK'; title: string; url: string }
  | { kind: 'FILE'; title: string; file: { name: string; type: string; size: number } }

export function materialTypeForFile(file: { name: string; type: string }): 'PDF' | 'SLIDES' | 'DOCX' | 'IMAGE' | null {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'PDF'
  if (/\.(pptx?|key)$/.test(name) || file.type.includes('presentation')) return 'SLIDES'
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) return 'DOCX'
  if ((PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) return 'IMAGE'
  return null
}

const MATERIAL_MAX: Record<'PDF' | 'SLIDES' | 'DOCX' | 'IMAGE', number> = {
  PDF: 50 * 1024 * 1024,
  SLIDES: 50 * 1024 * 1024,
  DOCX: 50 * 1024 * 1024,
  IMAGE: 20 * 1024 * 1024,
}

export function validateMaterial(draft: MaterialDraft): string | null {
  if (draft.title.trim().length < 1) return 'Give the material a title.'
  if (draft.kind === 'LINK') {
    try {
      const url = new URL(draft.url.trim())
      if (url.protocol !== 'https:') return 'Links must start with https://.'
      if (url.username || url.password) return 'Remove the username or password from the link.'
      if (draft.url.trim().length > 2048) return 'That link is too long.'
    } catch {
      return 'Enter a full link such as https://example.org/page.'
    }
    return null
  }
  const type = materialTypeForFile(draft.file)
  if (!type) return 'Upload a PDF, slides, a Word document or a photo (JPEG, PNG, WebP).'
  if (draft.file.size > MATERIAL_MAX[type]) return `That file is over the ${MATERIAL_MAX[type] / 1024 / 1024} MB limit.`
  return null
}

export async function addOnboardingMaterial(request: TeachingRequestFn, topic: FirstTopic, draft: MaterialDraft, file?: File) {
  const base = `/plans/${encodeURIComponent(topic.planId)}/topics/${encodeURIComponent(topic.topicId)}/materials`
  if (draft.kind === 'LINK') {
    await request<unknown>(base, 'POST', { type: 'EXTERNAL_LINK', title: draft.title.trim(), externalUrl: draft.url.trim() })
    return
  }
  const type = materialTypeForFile(draft.file)
  if (!type || !file) throw new Error('Choose a file first.')
  const target = photoUploadUrlSchema.parse(
    await request<unknown>(`${base}/upload-url`, 'POST', { type, filename: draft.file.name, mimeType: draft.file.type, sizeBytes: draft.file.size }),
  )
  const put = await fetch(target.uploadUrl, { method: 'PUT', headers: { 'Content-Type': draft.file.type }, body: file })
  if (!put.ok) throw new Error('The file could not be uploaded. Your title is kept; try again.')
  await request<unknown>(base, 'POST', {
    type,
    title: draft.title.trim(),
    storageKey: target.storageKey,
    mimeType: draft.file.type,
    sizeBytes: draft.file.size,
  })
}
