'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LessonsApi, LessonVariant, TeachingLessonDetail } from '@/lib/api/teaching/lessons'
import { canonicalLesson, validateLesson, type TeacherLessonContent, type ValidationIssue } from '@/lib/api/teaching/lesson-schema'
import { isRevisionConflict, teachingErrorText } from '@/lib/api/teaching/plans'

/** Blank list items, objectives and terms are editing scaffolding, not content: they are dropped before the draft is validated or saved. */
export function normaliseLesson(content: TeacherLessonContent): TeacherLessonContent {
  const keepTerms = (terms: { term: string; definition: string }[]) => terms.filter(term => term.term.trim() || term.definition.trim())
  return {
    ...content,
    title: content.title.trim(),
    objectives: content.objectives.map(entry => entry.trim()).filter(Boolean),
    keyTerms: keepTerms(content.keyTerms),
    steps: content.steps.map(step => ({
      ...step,
      title: step.title.trim(),
      coLine: step.coLine && step.coLine.trim() ? step.coLine : null,
      blocks: step.blocks.map(block => block.type === 'LIST' ? { ...block, items: block.items.map(item => item.trim()).filter(Boolean) } : block.type === 'KEY_TERMS' ? { ...block, terms: keepTerms(block.terms) } : block),
      check: step.check ? { ...step.check, hint: step.check.hint && step.check.hint.trim() ? step.check.hint : null } : null,
    })),
  }
}
export const sourceIdsOf = (content: TeacherLessonContent) => [...new Set(content.steps.flatMap(step => step.sources.map(source => source.materialId)))]

export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'invalid' | 'conflict'
export interface DraftSeed { content: TeacherLessonContent; revision: number | null; version: number | null; baseVersion?: number; savedCanonical: string | null }
export const AUTOSAVE_MS = 1200

/**
 * Autosave for one lesson draft (F-T3-03 / F-T3-05). Edits stay in memory and are saved after a pause with the draft's
 * `expectedRevision`. Rules: the same content is never re-sent; only a draft that passes the hard rules is sent (the others
 * are reported as `invalid` and stay on screen); a failure keeps every edit and offers a retry; a revision conflict
 * lets the teacher keep their edits (adopt the latest revision) or load the saved draft. Saving never publishes.
 */
export function useLessonDraft({ api, planId, topicId, variant, seed, debounceMs = AUTOSAVE_MS, onSaved }: {
  api: LessonsApi; planId: string; topicId: string; variant: LessonVariant; seed: DraftSeed; debounceMs?: number; onSaved?: (detail: TeachingLessonDetail) => void
}) {
  const [content, setContentState] = useState(seed.content)
  const [state, setState] = useState<SaveState>(seed.savedCanonical === null ? 'dirty' : 'clean')
  const [error, setError] = useState<string | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [version, setVersion] = useState<number | null>(seed.version)
  const [revision, setRevision] = useState<number | null>(seed.revision)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const latest = useRef(content)
  const rev = useRef(seed.revision)
  const base = useRef(seed.baseVersion)
  const saved = useRef(seed.savedCanonical)
  const inFlight = useRef<Promise<TeachingLessonDetail | null> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(seed.savedCanonical === null)
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  const run = useCallback(async (): Promise<TeachingLessonDetail | null> => {
    clearTimer()
    if (inFlight.current) { await inFlight.current; if (!dirty.current) return null }
    const body = normaliseLesson(latest.current)
    const text = canonicalLesson(body)
    if (text === saved.current) { dirty.current = false; setState(current => current === 'dirty' || current === 'invalid' ? 'clean' : current); setIssues([]); return null }
    const problems = validateLesson(body)
    if (problems.length > 0) { setIssues(problems); setState('invalid'); return null }
    setIssues([]); setError(null); setState('saving')
    const job = (async () => {
      try {
        const detail = await api.saveDraft(planId, topicId, variant, {
          expectedRevision: rev.current, ...(rev.current === null && base.current ? { baseVersion: base.current } : {}), content: body, sourceMaterialIds: sourceIdsOf(body),
        })
        rev.current = detail.revision; base.current = undefined; saved.current = text
        setRevision(detail.revision); setVersion(detail.version); setSavedAt(new Date())
        if (canonicalLesson(normaliseLesson(latest.current)) === text) { dirty.current = false; setState('saved') }
        else { setState('dirty'); timer.current = setTimeout(() => void run(), debounceMs) }
        onSavedRef.current?.(detail)
        return detail
      } catch (failure) {
        if (isRevisionConflict(failure)) { setState('conflict'); setError('This draft was changed somewhere else (for example in another tab).') }
        else { setState('error'); setError(teachingErrorText(failure)) }
        return null
      } finally { inFlight.current = null }
    })()
    inFlight.current = job
    return job
  // `run` only reads refs and stable props.
  }, [api, planId, topicId, variant, debounceMs])

  const setContent = useCallback((update: TeacherLessonContent | ((current: TeacherLessonContent) => TeacherLessonContent)) => {
    const next = typeof update === 'function' ? update(latest.current) : update
    latest.current = next; dirty.current = true
    setContentState(next)
    setState(current => current === 'saving' ? current : 'dirty')
    clearTimer()
    timer.current = setTimeout(() => void run(), debounceMs)
  }, [run, debounceMs])

  /** Saves now (before a preview or publish). Resolves with the saved detail, or null when nothing needed saving or it could not be saved. */
  const flush = useCallback(async () => { clearTimer(); return run() }, [run])

  /** Conflict: keep the teacher's edits and adopt the server's current revision for the next save. */
  const keepMine = useCallback(async () => {
    try {
      const versions = await api.list(planId, topicId)
      const draft = versions.find(entry => entry.variant === variant && entry.status === 'DRAFT')
      rev.current = draft ? draft.revision : null
      setRevision(rev.current); setError(null); setState('dirty')
      return run()
    } catch (failure) { setState('error'); setError(teachingErrorText(failure)); return null }
  }, [api, planId, topicId, variant, run])
  /** Conflict: drop the local edits and load the saved draft. */
  const loadSaved = useCallback(async () => {
    try {
      const versions = await api.list(planId, topicId)
      const draft = versions.find(entry => entry.variant === variant && entry.status === 'DRAFT')
      if (!draft) { setState('error'); setError('There is no saved draft any more.'); return }
      const detail = await api.get(planId, topicId, draft.version, variant)
      latest.current = detail.content; rev.current = detail.revision; saved.current = canonicalLesson(detail.content); dirty.current = false
      setContentState(detail.content); setRevision(detail.revision); setVersion(detail.version); setError(null); setIssues([]); setState('clean')
    } catch (failure) { setState('error'); setError(teachingErrorText(failure)) }
  }, [api, planId, topicId, variant])
  /** After the draft was discarded or published elsewhere in this tab. */
  const markDiscarded = useCallback(() => { clearTimer(); dirty.current = false }, [])

  useEffect(() => () => clearTimer(), [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  // A first save for a brand-new local draft is NOT scheduled until the teacher edits (an untouched template is not saved).

  return { content, setContent, state, error, issues, version, revision, savedAt, flush, keepMine, loadSaved, retry: run, markDiscarded }
}
