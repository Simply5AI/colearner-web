import { z } from 'zod'
import { teachingAiStateSchema } from './dashboard'
import { lessonSummarySchema } from './lessons'
import { linkedQuestionSchema, teachingMaterialSchema } from './materials'
import { idempotent, parseResponse, planStatusSchema, type TeachingRequest } from './plans'

/* B12 section 6.4: the topic workspace. Linked questions carry no answer, option or explanation field (the schema is strict). */
const iso = z.string().min(1)
export const topicWorkspaceSchema = z.object({
  planId: z.string().min(1), planStatus: planStatusSchema, planRevision: z.number().int().nonnegative(), frozen: z.boolean(),
  topic: z.object({
    id: z.string().min(1), title: z.string(), description: z.string().nullable(), dueAt: iso.nullable(), parentTopicId: z.string().nullable(), phaseTitle: z.string().nullable(),
  }),
  materials: z.array(teachingMaterialSchema), questions: z.array(linkedQuestionSchema),
  lesson: z.object({ draft: lessonSummarySchema.nullable(), published: lessonSummarySchema.nullable(), versions: z.array(lessonSummarySchema) }),
  ai: z.object({ generateLesson: teachingAiStateSchema, generateWorksheet: teachingAiStateSchema, differentiate: teachingAiStateSchema }),
  worksheet: z.object({ available: z.literal(false), reason: z.string() }),
  /** Present on a PATCH: a past due date is accepted and reported here, never silently moved. */
  warnings: z.array(z.string()).optional(),
})
export type TopicWorkspace = z.infer<typeof topicWorkspaceSchema>

const path = (planId: string, topicId: string) => `/plans/${encodeURIComponent(planId)}/topics/${encodeURIComponent(topicId)}`

export function topicsApi(request: TeachingRequest) {
  return {
    get: async (planId: string, topicId: string) => parseResponse(topicWorkspaceSchema, await request<unknown>(path(planId, topicId))),
    update: async (planId: string, topicId: string, body: { expectedRevision: number; title?: string; description?: string; dueAt?: string | null }) =>
      parseResponse(topicWorkspaceSchema, await request<unknown>(path(planId, topicId), 'PATCH', body, idempotent())),
  }
}
export type TopicsApi = ReturnType<typeof topicsApi>
