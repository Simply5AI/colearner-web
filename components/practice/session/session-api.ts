import { linkSchema } from '@/lib/api/learn'
import { learnRequest } from '@/lib/api/learn-request'
import { hintResultSchema, isPracticeId, practiceApi } from '@/lib/api/practice'
import { asQuestion } from './practice-types'

/**
 * The platform's hint receipt also carries `sourceLink` (the "look back at your teacher's material" rung of a teacher
 * question, whose question view has no link of its own). W2's `hintResultSchema` drops it, so the player reads the hint
 * through this extension and keeps the link.
 */
export const hintReceiptSchema = hintResultSchema.extend({ sourceLink: linkSchema.nullable().optional().transform(value => value ?? null) })
const hintPath = (sessionId: string, index: number) => `/practice/sessions/${encodeURIComponent(sessionId)}/items/${Math.max(0, Math.floor(index))}/hint`

/*
 * The calls the session player makes, all through W2's `practiceApi` (Zod-parsed, same-origin BFF at /api/learn).
 * A learner question that carries an answer key, rubric or explanation is refused whole by `questionViewSchema`, and an
 * unrevealed answer in a receipt is refused too, so a key is never held in memory.
 */
export const practiceSessionApi = {
  session: practiceApi.session,
  question: async (sessionId: string, index: number) => asQuestion(await practiceApi.item(sessionId, index)),
  answer: practiceApi.answer,
  hint: (sessionId: string, index: number, level: 1 | 2 | 3) => learnRequest(hintPath(sessionId, index), hintReceiptSchema, 'POST', { level }),
  skip: practiceApi.skip,
  complete: practiceApi.complete,
}
export type PracticeSessionApi = typeof practiceSessionApi

export const isSessionId = isPracticeId
