import { mockQuestions } from '@/lib/fixtures/teacher-ui'
import type { TeacherQuestion, TeacherQuestionStatus } from '@/lib/types/teacher'

type QuestionsGlobal = typeof globalThis & {
  __teacherQuestionsStore?: TeacherQuestion[]
}

const storeKey = '__teacherQuestionsStore'

function getStore(): TeacherQuestion[] {
  const globalStore = globalThis as QuestionsGlobal
  if (!globalStore[storeKey]) {
    globalStore[storeKey] = structuredClone(mockQuestions)
  }
  return globalStore[storeKey]!
}

export function listTeacherQuestions(filters?: {
  planId?: string
  topicId?: string
  status?: TeacherQuestionStatus
}): TeacherQuestion[] {
  return getStore()
    .filter((question) => (filters?.planId ? question.planId === filters.planId : true))
    .filter((question) => (filters?.topicId ? question.topicId === filters.topicId : true))
    .filter((question) => (filters?.status ? question.status === filters.status : true))
    .map((question) => structuredClone(question))
}

export function getTeacherQuestion(questionId: string): TeacherQuestion | null {
  const question = getStore().find((entry) => entry.id === questionId)
  return question ? structuredClone(question) : null
}

export function createTeacherQuestion(
  input: Omit<TeacherQuestion, 'id' | 'status'> & { status?: TeacherQuestionStatus },
): TeacherQuestion {
  const question: TeacherQuestion = {
    ...input,
    id: `q-${crypto.randomUUID().slice(0, 8)}`,
    status: input.status ?? 'DRAFT',
  }
  getStore().unshift(question)
  return structuredClone(question)
}

export function updateTeacherQuestion(
  questionId: string,
  patch: Partial<Omit<TeacherQuestion, 'id' | 'planId'>>,
): TeacherQuestion | null {
  const index = getStore().findIndex((entry) => entry.id === questionId)
  if (index < 0) return null
  getStore()[index] = { ...getStore()[index], ...patch }
  return structuredClone(getStore()[index]!)
}

export function publishTeacherQuestion(questionId: string): TeacherQuestion | null {
  return updateTeacherQuestion(questionId, { status: 'PUBLISHED' })
}

export function archiveTeacherQuestion(questionId: string): TeacherQuestion | null {
  return updateTeacherQuestion(questionId, { status: 'ARCHIVED' })
}

export function deleteTeacherQuestion(questionId: string): boolean {
  const index = getStore().findIndex((entry) => entry.id === questionId)
  if (index < 0) return false
  getStore().splice(index, 1)
  return true
}