'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { FIXTURE_LESSON } from '@/app/dev/teacher/plans/mock-server'
import { LearnIdentityProvider } from '@/components/learn/learn-common'
import { fixtureBands, planFixture } from '@/components/learn/dev/learn-fixtures'
import { LearnPlanScreen } from '@/components/learn/learn-plan'
import type { LearnBand, PlanDetail } from '@/lib/api/learn'

const isBand = (value: string | null): value is LearnBand => fixtureBands.includes(value as LearnBand)

/** The learner's view of a published teacher lesson, built from the real plan view and reader. All responses are synthetic fixtures. */
export function learnerLessonView() {
  return {
    schemaVersion: '1.0', title: FIXTURE_LESSON.title, objectives: FIXTURE_LESSON.objectives, keyTerms: FIXTURE_LESSON.keyTerms, locale: 'en',
    steps: FIXTURE_LESSON.steps.map(step => ({ id: step.id, kind: step.kind, title: step.title, coLine: step.coLine, blocks: step.blocks, sources: step.sources, check: step.check ? { question: step.check.question, hint: step.check.hint, options: step.check.options.map(({ id, text }) => ({ id, text })) } : null })),
  }
}
export function withTeacherLesson(detail: PlanDetail, topicId: string): PlanDetail {
  return { ...detail, phases: detail.phases.map(phase => ({ ...phase, topics: phase.topics.map(topic => topic.id === topicId ? { ...topic, teacherLesson: { version: 2, title: FIXTURE_LESSON.title, stepCount: FIXTURE_LESSON.steps.length, publishedAt: '2026-10-22T08:00:00Z' } } : topic) })) }
}

export function TeacherLessonHarness() {
  const params = useSearchParams()
  const client = useQueryClient()
  const band: LearnBand = isBand(params.get('band')) ? params.get('band') as LearnBand : 'tweens'
  const state = params.get('state') ?? 'default'
  const signature = params.toString()
  const [ready, setReady] = useState(false)
  const fixture = planFixture(band)
  const topicId = band === 'kids' ? 't-leaves' : band === 'tweens' ? 't1' : 't-acids'
  const planId = fixture.detail.plan.id

  useEffect(() => {
    const original = window.fetch
    client.clear()
    const envelope = (data: unknown, status = 200) => Response.json({ statusCode: status, data, timestamp: '2026-10-22T08:00:00Z' }, { status })
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('/api/learn/')) return original(input, init)
      if (url.endsWith(`/plans/${planId}`)) return envelope(state === 'no-lesson' ? fixture.detail : withTeacherLesson(fixture.detail, topicId))
      if (url.endsWith(`/topics/${topicId}/teacher-lesson/check`)) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { stepIndex: number; optionId: string }
        const check = FIXTURE_LESSON.steps[body.stepIndex]?.check
        const option = check?.options.find(entry => entry.id === body.optionId)
        if (!check || !option) return Response.json({ code: 'LESSON_UNAVAILABLE' }, { status: 404 })
        const correct = option.id === check.correctOptionId
        return envelope({ correct, feedback: option.feedback, correctOptionId: correct ? option.id : null })
      }
      if (url.endsWith(`/topics/${topicId}/teacher-lesson`)) {
        if (state === 'unavailable') return Response.json({ code: 'LESSON_UNAVAILABLE' }, { status: 404 })
        const view = learnerLessonView()
        // `leak` proves the web refuses a learner payload that carries the answer key.
        if (state === 'leak') (view.steps[3]!.check as Record<string, unknown>).correctOptionId = 'opt-b'
        return envelope({ planId, topicId, version: 2, publishedAt: '2026-10-22T08:00:00Z', view })
      }
      return Response.json({ code: 'NOT_FOUND' }, { status: 404 })
    }
    const previous = document.documentElement.dir
    document.documentElement.dir = params.get('dir') === 'rtl' ? 'rtl' : 'ltr'
    setReady(true)
    return () => { window.fetch = original; document.documentElement.dir = previous; setReady(false) }
  // Every setup parameter is represented in signature.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return <div className="min-h-screen bg-background text-foreground">
    <p role="note" className="border-b border-border bg-muted p-3 text-center text-sm font-bold">B12 development qualification · synthetic fixtures · no real learner, teacher or platform</p>
    {ready && <LearnIdentityProvider key={signature} scope={`harness:b12:${signature}`} band={band}><LearnPlanScreen planId={planId} /></LearnIdentityProvider>}
  </div>
}
