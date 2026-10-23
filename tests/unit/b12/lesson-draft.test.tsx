import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { FIXTURE_LESSON } from '@/app/dev/teacher/plans/mock-server'
import { canonicalLesson, newLesson, type TeacherLessonContent } from '@/lib/api/teaching/lesson-schema'
import type { LessonsApi, TeachingLessonDetail } from '@/lib/api/teaching/lessons'
import { AUTOSAVE_MS, useLessonDraft, type DraftSeed } from '@/components/teacher/plans/lesson-draft'

const detail = (content: TeacherLessonContent, revision: number): TeachingLessonDetail => ({ variant: 'STANDARD', version: 2, status: 'DRAFT', title: content.title, stepCount: content.steps.length, origin: 'MANUAL', revision, updatedAt: 'x', publishedAt: null, authoredByMe: true, content, sourceMaterialIds: [], contentHash: 'h' })
const seed = (): DraftSeed => ({ content: FIXTURE_LESSON, revision: 3, version: 2, savedCanonical: canonicalLesson(FIXTURE_LESSON) })
function setup(overrides: Partial<LessonsApi> = {}, initial: DraftSeed = seed()) {
  const saveDraft = vi.fn(async (_p: string, _t: string, _v: string, input: { content: TeacherLessonContent; expectedRevision: number | null }) => detail(input.content, (input.expectedRevision ?? -1) + 1))
  const api = { saveDraft, list: vi.fn(async () => [{ variant: 'STANDARD', version: 2, status: 'DRAFT', revision: 9, title: 't', stepCount: 1, origin: 'MANUAL', updatedAt: 'x', publishedAt: null, authoredByMe: true }]), get: vi.fn(), ...overrides } as unknown as LessonsApi
  const hook = renderHook(() => useLessonDraft({ api, planId: 'p', topicId: 't', variant: 'STANDARD', seed: initial }))
  return { api, saveDraft, hook }
}
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })
const edit = (hook: ReturnType<typeof setup>['hook'], title: string) => act(() => { hook.result.current.setContent(current => ({ ...current, title })) })

it('saves after a pause with the draft revision, once for a burst of edits', async () => {
  const { hook, saveDraft } = setup()
  edit(hook, 'A'); edit(hook, 'Ab'); edit(hook, 'Abc')
  expect(hook.result.current.state).toBe('dirty'); expect(saveDraft).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10) })
  expect(saveDraft).toHaveBeenCalledOnce()
  expect(saveDraft.mock.calls[0]![3]).toMatchObject({ expectedRevision: 3, content: { title: 'Abc' } })
  expect(hook.result.current.state).toBe('saved'); expect(hook.result.current.revision).toBe(4)
})
it('never re-sends content that is already saved', async () => {
  const { hook, saveDraft } = setup()
  edit(hook, 'X'); await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10) })
  edit(hook, 'X'); await act(async () => { await hook.result.current.flush() })
  expect(saveDraft).toHaveBeenCalledOnce()
})
it('does not send a draft that breaks a hard rule and says why, keeping the edit', async () => {
  const { hook, saveDraft } = setup()
  edit(hook, '')
  await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10) })
  expect(saveDraft).not.toHaveBeenCalled(); expect(hook.result.current.state).toBe('invalid')
  expect(hook.result.current.issues.some(issue => issue.path === 'title')).toBe(true); expect(hook.result.current.content.title).toBe('')
})
it('a failed save keeps the edits, reports it and a retry succeeds', async () => {
  let fail = true
  const { hook, saveDraft } = setup({ saveDraft: vi.fn(async (_p: string, _t: string, _v: string, input: { content: TeacherLessonContent; expectedRevision: number | null }) => { if (fail) throw new TeachingApiError(503, 'The teaching service is unavailable.'); return detail(input.content, 4) }) } as unknown as Partial<LessonsApi>)
  void saveDraft
  edit(hook, 'Kept')
  await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10) })
  expect(hook.result.current.state).toBe('error'); expect(hook.result.current.content.title).toBe('Kept'); expect(hook.result.current.error).toMatch(/unavailable/i)
  fail = false
  await act(async () => { await hook.result.current.retry() })
  expect(hook.result.current.state).toBe('saved')
})
it('a revision conflict lets the teacher keep their edits with the latest revision', async () => {
  let calls = 0
  const saveDraft = vi.fn(async (_p: string, _t: string, _v: string, input: { content: TeacherLessonContent; expectedRevision: number | null }) => { calls += 1; if (calls === 1) throw new TeachingApiError(409, 'conflict', 'REVISION_CONFLICT', 9); return detail(input.content, 10) })
  const { hook } = setup({ saveDraft } as unknown as Partial<LessonsApi>)
  edit(hook, 'Mine'); await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10) })
  expect(hook.result.current.state).toBe('conflict'); expect(hook.result.current.content.title).toBe('Mine')
  await act(async () => { await hook.result.current.keepMine() })
  expect(saveDraft.mock.calls[1]![3]).toMatchObject({ expectedRevision: 9, content: { title: 'Mine' } }); expect(hook.result.current.state).toBe('saved')
})
it('a brand-new local draft is not saved until it is edited, then creates the draft with expectedRevision null', async () => {
  const { hook, saveDraft } = setup({}, { content: newLesson(''), revision: null, version: null, savedCanonical: null })
  await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS * 3) })
  expect(saveDraft).not.toHaveBeenCalled()
  act(() => { hook.result.current.setContent({ ...FIXTURE_LESSON }) })
  await act(async () => { await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10) })
  expect(saveDraft.mock.calls[0]![3]).toMatchObject({ expectedRevision: null }); expect(hook.result.current.version).toBe(2)
})
