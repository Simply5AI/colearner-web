import { z } from 'zod'
import { idempotent, parseResponse, type TeachingRequest } from './plans'

/* B12 section 6.10: assign an own published plan to an own class. Roster data is counts only; no student is named here. */
const count = z.number().int().nonnegative()
export const planAssignmentSchema = z.object({
  id: z.string().min(1), planId: z.string().min(1), classId: z.string().min(1), classLabel: z.string(), dueAt: z.string().nullable(),
  source: z.enum(['TEACHER', 'SCHOOL_ADMIN']), createdAt: z.string().min(1),
  roster: z.object({
    total: count, enrolledActive: count, pendingGuardian: count, alreadyEnrolled: count,
    skipped: z.array(z.object({ count, reason: z.enum(['NO_ACCOUNT', 'POLICY_BLOCKED']) })),
  }),
  /** False when the class already had this plan (natural idempotency). */
  changed: z.boolean().optional(),
})
export type PlanAssignment = z.infer<typeof planAssignmentSchema>
const listSchema = z.object({ items: z.array(planAssignmentSchema) })
const removedSchema = z.object({ removed: z.boolean(), revoked: count, retained: count })
export type UnassignResult = z.infer<typeof removedSchema>

const base = (planId: string) => `/plans/${encodeURIComponent(planId)}/assignments`

export function assignmentsApi(request: TeachingRequest) {
  return {
    list: async (planId: string) => parseResponse(listSchema, await request<unknown>(base(planId))).items,
    create: async (planId: string, input: { classId: string; dueAt?: string | null }, key: string) =>
      parseResponse(planAssignmentSchema, await request<unknown>(base(planId), 'POST', input, idempotent(key))),
    sync: async (planId: string, assignmentId: string) =>
      parseResponse(planAssignmentSchema, await request<unknown>(`${base(planId)}/${encodeURIComponent(assignmentId)}/sync`, 'POST', {}, idempotent())),
    setDueAt: async (planId: string, assignmentId: string, dueAt: string | null) =>
      parseResponse(planAssignmentSchema, await request<unknown>(`${base(planId)}/${encodeURIComponent(assignmentId)}`, 'PATCH', { dueAt }, idempotent())),
    unassign: async (planId: string, assignmentId: string) =>
      parseResponse(removedSchema, await request<unknown>(`${base(planId)}/${encodeURIComponent(assignmentId)}`, 'DELETE', undefined, idempotent())),
  }
}
export type AssignmentsApi = ReturnType<typeof assignmentsApi>
