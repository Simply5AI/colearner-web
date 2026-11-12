'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Archive, Check, Save, Trash2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InlineAlert, LoadingBlock, NativeSelect } from '@/components/teacher/plans/fields'
import { dateText } from '@/components/teacher/plans/plan-format'
import { IntentKey, isDenied, isUnavailable, teachingErrorText } from '@/lib/api/teaching/plans'
import { errorCode, isVersionConflict, questionErrorText, serverIssues } from '@/lib/api/teaching/questions'
import {
  authorOnlyTypes, contentForType, difficultyLabel, difficulties, normaliseContent, originLabel, questionTypes, typeLabel, validateQuestion,
  type QuestionContent, type QuestionDetail, type QuestionDifficulty, type QuestionIssue, type QuestionType,
} from '@/lib/api/teaching/question-schema'
import { AnswerEditor, AnswerKeyHeading, ExplanationField, HintsEditor, PromptField } from './question-fields'
import { AuthorOnlyBadge, QuestionFlags, StatusChips, SuccessRate } from './question-flags'
import { ProvenancePanel } from './question-provenance'
import { questionKeys, usePlanOptions, usePlanTopics, useQuestionApis, useTopicMaterials } from './use-question-apis'

type Confirm = null | 'archive' | 'discard' | 'delete' | 'reject'

/** Loads one question for editing, or starts a new one. Denied, unavailable and retry states are explicit. */
export function QuestionEditor({ questionId, planId, topicId }: { questionId?: string; planId?: string; topicId?: string }) {
  const apis = useQuestionApis()
  const detail = useQuery({
    queryKey: questionKeys.detail(apis.schoolId, questionId ?? 'new'), enabled: !!questionId, queryFn: () => apis.questions.get(questionId!),
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
  })
  if (!questionId) return <EditorBody key="new" detail={null} initialPlanId={planId ?? ''} initialTopicId={topicId ?? ''} />
  if (detail.isPending) return <LoadingBlock label="Loading the question" />
  if (detail.error) {
    return isDenied(detail.error)
      ? <InlineAlert testId="editor-denied">This question was not found, or you do not have access to it.</InlineAlert>
      : <div className="space-y-3" data-testid="editor-error"><InlineAlert>{isUnavailable(detail.error) ? 'The question bank is unavailable right now. Try again in a moment.' : teachingErrorText(detail.error)}</InlineAlert><Button variant="outline" onClick={() => void detail.refetch()}>Retry</Button></div>
  }
  return <EditorBody key={detail.data.id} detail={detail.data} initialPlanId={detail.data.planId} initialTopicId={detail.data.topicId} />
}

const startingContent = (detail: QuestionDetail | null, topicId: string): QuestionContent =>
  detail ? (detail.draftRevision?.content ?? detail.content) : contentForType('MCQ', { topicId })

function EditorBody({ detail: initial, initialPlanId, initialTopicId }: { detail: QuestionDetail | null; initialPlanId: string; initialTopicId: string }) {
  const router = useRouter()
  const apis = useQuestionApis()
  const client = useQueryClient()
  const [detail, setDetail] = useState<QuestionDetail | null>(initial)
  const [planId, setPlanId] = useState(initialPlanId)
  const [form, setForm] = useState<QuestionContent>(() => startingContent(initial, initialTopicId))
  const [baseline, setBaseline] = useState(() => JSON.stringify(normaliseContent(startingContent(initial, initialTopicId))))
  const [showIssues, setShowIssues] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [remote, setRemote] = useState<QuestionIssue[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const createKey = useRef(new IntentKey())
  const formId = useId()

  const plans = usePlanOptions()
  const topics = usePlanTopics(planId || undefined)
  const materials = useTopicMaterials(planId || undefined, form.topicId || undefined)
  const images = useMemo(() => (materials.data ?? []).filter(m => m.type === 'IMAGE'), [materials.data])

  const readOnly = detail?.status === 'ARCHIVED'
  const dirty = JSON.stringify(normaliseContent(form)) !== baseline
  const issues = useMemo(() => (showIssues ? [...validateQuestion(form), ...remote.filter(r => !validateQuestion(form).some(v => v.path === r.path))] : []), [showIssues, form, remote])
  const canDelete = !!detail && detail.status === 'DRAFT' && (detail.origin === 'MANUAL' || detail.origin === 'CSV') && detail.version <= 1 && !detail.revisions.some(r => r.state === 'PUBLISHED')
  const pendingCo = !!detail && detail.origin === 'CO' && (detail.reviewState === 'PENDING_REVIEW' || detail.reviewState === 'EDITED') && detail.status === 'DRAFT'

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
  useEffect(() => {
    if (attempts === 0) return
    const target = document.querySelector<HTMLElement>('[data-field-error] textarea, [data-field-error] input, [data-field-error] select, fieldset [aria-invalid="true"]')
    target?.focus()
  }, [attempts])

  const refresh = () => void client.invalidateQueries({ queryKey: questionKeys.root(apis.schoolId) })
  const adopt = (next: QuestionDetail, resetForm: boolean) => {
    setDetail(next)
    if (resetForm) { const content = startingContent(next, next.topicId); setForm(content); setBaseline(JSON.stringify(normaliseContent(content))) }
    else setBaseline(JSON.stringify(normaliseContent(next.draftRevision?.content ?? next.content)))
    refresh()
  }
  const change = (next: QuestionContent) => { setForm(next); setMessage(null) }

  /** Runs one server action. Failures keep the form exactly as it is; a version conflict opens the conflict panel. */
  async function run<T>(label: string, action: () => Promise<T>): Promise<T | null> {
    setBusy(label); setFailure(null); setMessage(null)
    try { return await action() }
    catch (error) {
      if (isVersionConflict(error)) setConflict(true)
      else if (errorCode(error) === 'QUESTION_INVALID' || serverIssues(error)) { setShowIssues(true); setAttempts(n => n + 1); setRemote(serverIssues(error, form) ?? []); setFailure(questionErrorText(error)) }
      else setFailure(questionErrorText(error))
      return null
    } finally { setBusy(null) }
  }

  const check = (): boolean => {
    const found = validateQuestion(form)
    setShowIssues(true); setRemote([])
    if (found.length > 0) { setAttempts(n => n + 1); setFailure('Some fields need attention before this can be saved.'); return false }
    return true
  }

  /** Saves the form; returns the saved question (and navigates to it when it was just created). */
  async function persist(): Promise<QuestionDetail | null> {
    if (!check()) return null
    const content = normaliseContent(form)
    if (!detail) {
      if (!planId) { setFailure('Choose a plan first.'); return null }
      const created = await run('save', () => apis.questions.create(planId, content, createKey.current.keyFor({ planId, content })))
      if (created) { createKey.current.done(); adopt(created, false); setMessage('Saved as a draft.') }
      return created
    }
    if (dirty) {
      const saved = await run('save', () => apis.questions.update(detail.id, content, detail.version))
      if (saved) { adopt(saved, false); setMessage(saved.status === 'PUBLISHED' ? 'Saved as a draft revision. Learners still see the published version.' : 'Saved.') }
      return saved
    }
    return detail
  }

  const onSave = async () => {
    const saved = await persist()
    if (saved && !initial) router.replace(`/teacher/questions/${encodeURIComponent(saved.id)}`)
  }
  const onPublish = async () => {
    const saved = await persist()
    if (!saved) return
    const published = await run('publish', () => apis.questions.publish(saved.id, saved.version))
    if (published) { adopt(published, true); setMessage('Published. Learners can now see this version.'); if (!initial) router.replace(`/teacher/questions/${encodeURIComponent(published.id)}`) }
  }
  const onReview = async (decision: 'ACCEPT' | 'REJECT') => {
    if (!detail) return
    const saved = decision === 'ACCEPT' ? await persist() : detail
    if (!saved) return
    const result = await run(decision === 'ACCEPT' ? 'publish' : 'reject', () => apis.questions.review(saved.id, decision, saved.version))
    if (result) { adopt(result, true); setConfirm(null); setMessage(decision === 'ACCEPT' ? 'Accepted and published.' : 'Rejected. The question is archived and its history is kept.') }
  }
  const onDiscard = async () => {
    if (!detail) return
    const result = await run('discard', () => apis.questions.discardDraft(detail.id))
    setConfirm(null)
    if (result) { adopt(result, true); setMessage('Draft revision discarded. The published version is unchanged.') }
  }
  const onArchive = async () => {
    if (!detail) return
    const result = await run('archive', () => apis.questions.archive(detail.id))
    setConfirm(null)
    if (result) { adopt(result, true); setMessage('Archived. Learners no longer see this question; its history is kept.') }
  }
  const onDelete = async () => {
    if (!detail) return
    const done = await run('delete', async () => { await apis.questions.remove(detail.id); return true })
    setConfirm(null)
    if (done) { refresh(); router.replace('/teacher/questions') }
  }
  async function reloadLatest(keepEdits: boolean) {
    if (!detail) return
    const latest = await run('reload', () => apis.questions.get(detail.id))
    if (!latest) return
    setConflict(false)
    if (keepEdits) { setDetail(latest); setMessage(`Loaded the latest version (${latest.version}). Your edits are kept; saving will replace the newer draft.`) }
    else { adopt(latest, true); setMessage('Loaded the latest version.') }
  }

  const topicTitle = topics.data?.find(t => t.id === form.topicId)?.title
  const typeChoice = (type: QuestionType) => change(contentForType(type, form))
  const actionDisabledReason = readOnly ? 'This question is archived, so it can no longer be changed.' : null
  const nothingToPublish = !!detail && detail.status === 'PUBLISHED' && !detail.hasDraftRevision && !dirty
  const busyNow = busy !== null

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]" data-testid="question-editor">
    <div className="space-y-6">
      <Link href="/teacher/questions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" />All questions</Link>

      {readOnly && <InlineAlert tone="locked" testId="archived-note">This question is archived. Learners no longer see it and it can no longer be changed. Its history is kept.</InlineAlert>}
      {detail?.hasDraftRevision && !readOnly && <InlineAlert tone="info" testId="draft-revision-banner">
        <p className="font-semibold">You are editing an unpublished draft revision{detail.draftRevision ? ` (updated ${dateText(detail.draftRevision.updatedAt, true)})` : ''}.</p>
        <p>Learners still see published version {detail.version}. They see your changes only after you publish.</p>
      </InlineAlert>}
      {pendingCo && <InlineAlert tone="info" testId="co-pending-banner">Co drafted this question and it has not been published. Read it carefully, edit what you need, then accept it to publish or reject it.</InlineAlert>}
      {conflict && <div role="alert" className="space-y-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-sm" data-testid="conflict-panel">
        <p className="font-semibold">This question was changed somewhere else.</p>
        <p>Your edits are still here and nothing was overwritten. Choose how to continue.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => void reloadLatest(true)} disabled={busyNow} data-testid="conflict-keep">Load the latest and keep my edits</Button>
          <Button variant="outline" size="lg" onClick={() => void reloadLatest(false)} disabled={busyNow} data-testid="conflict-discard">Discard my edits and load the latest</Button>
        </div>
      </div>}

      <form id={formId} noValidate className="space-y-6" onSubmit={event => { event.preventDefault(); if (!readOnly && !busyNow) void onSave() }} aria-label="Question editor">
        <fieldset disabled={readOnly} className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Question details">
            {!detail
              ? <NativeSelect label="Plan" value={planId} onChange={e => { setPlanId(e.target.value); change({ ...form, topicId: '' }) }} data-testid="field-plan" hint={planId ? undefined : 'Questions belong to one of your plans.'}>
                <option value="">Choose a plan</option>{plans.data?.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</NativeSelect>
              : <div className="space-y-1.5"><p className="text-sm font-medium">Plan</p><p className="flex h-9 items-center text-sm" data-testid="plan-name">{detail.planTitle}</p></div>}
            <NativeSelect label="Topic" value={form.topicId} onChange={e => change({ ...form, topicId: e.target.value })} disabled={!planId} data-testid="field-topic" aria-invalid={!!issues.find(i => i.path === 'topicId')}
              hint={issues.find(i => i.path === 'topicId')?.message}>
              <option value="">Choose a topic</option>{topics.data?.map(t => <option key={t.id} value={t.id}>{t.phase ? `${t.phase}: ` : ''}{t.title}</option>)}
              {detail && !topics.data?.some(t => t.id === form.topicId) && <option value={form.topicId}>{detail.topicTitle}</option>}</NativeSelect>
            {!detail
              ? <NativeSelect label="Question type" value={form.type} onChange={e => typeChoice(e.target.value as QuestionType)} data-testid="field-type"
                hint={authorOnlyTypes.includes(form.type) ? 'Learners do not see this type yet. You can write it, publish it and print it on a worksheet.' : undefined}>
                {questionTypes.map(t => <option key={t} value={t}>{typeLabel[t]}{authorOnlyTypes.includes(t) ? ' (author-only)' : ''}</option>)}</NativeSelect>
              : <div className="space-y-1.5"><p className="text-sm font-medium">Question type</p><p className="flex h-9 flex-wrap items-center gap-2 text-sm" data-testid="type-name">{typeLabel[form.type]}{detail.authorOnly && <AuthorOnlyBadge />}</p></div>}
            <NativeSelect label="Difficulty" value={form.difficulty ?? ''} onChange={e => change({ ...form, difficulty: (e.target.value || null) as QuestionDifficulty | null })} data-testid="field-difficulty">
              <option value="">Not set</option>{difficulties.map(d => <option key={d} value={d}>{difficultyLabel[d]}</option>)}</NativeSelect>
          </section>

          <PromptField content={form} onChange={change} issues={issues} />

          <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Answer key">
            <AnswerKeyHeading>Answer key</AnswerKeyHeading>
            <AnswerEditor content={form} onChange={change} issues={issues} images={images} />
            <ExplanationField content={form} onChange={change} issues={issues} />
            <HintsEditor content={form} onChange={change} issues={issues} />
          </section>

          {materials.data && materials.data.length > 0 && <fieldset className="space-y-1.5" data-testid="references">
            <legend className="text-sm font-medium">Material this question draws on (optional)</legend>
            {materials.data.map(m => <label key={m.id} className="flex min-h-9 items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={form.referenceMaterialIds.includes(m.id)}
              onChange={() => change({ ...form, referenceMaterialIds: form.referenceMaterialIds.includes(m.id) ? form.referenceMaterialIds.filter(x => x !== m.id) : [...form.referenceMaterialIds, m.id] })} /><span className="break-words">{m.title}</span></label>)}
          </fieldset>}
        </fieldset>

        <div className="sticky bottom-0 -mx-1 space-y-2 border-t border-border bg-background/95 px-1 py-3 backdrop-blur" data-testid="action-bar">
          <div role="status" aria-live="polite" className="min-h-5 text-sm" data-testid="editor-status">{busyNow ? 'Working…' : message}</div>
          {failure && <InlineAlert testId="editor-failure">{failure}</InlineAlert>}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" variant="outline" aria-disabled={readOnly || busyNow || (!dirty && !!detail) || undefined} data-testid="save"
              onClick={event => { if (readOnly || busyNow || (!dirty && detail)) event.preventDefault() }}><Save aria-hidden="true" />{detail ? 'Save' : 'Save draft'}</Button>
            {pendingCo
              ? <><Button type="button" size="lg" onClick={() => void onReview('ACCEPT')} aria-disabled={busyNow || undefined} data-testid="accept"><Check aria-hidden="true" />Accept and publish</Button>
                <Button type="button" size="lg" variant="outline" onClick={() => setConfirm('reject')} aria-disabled={busyNow || undefined} data-testid="reject">Reject</Button></>
              : <Button type="button" size="lg" onClick={() => void onPublish()} aria-disabled={readOnly || busyNow || nothingToPublish || undefined} aria-describedby={actionDisabledReason || nothingToPublish ? `${formId}-publish-reason` : undefined} data-testid="publish">
                {detail?.status === 'PUBLISHED' ? 'Publish changes' : 'Publish'}</Button>}
            {(actionDisabledReason || nothingToPublish) && <span id={`${formId}-publish-reason`} className="text-xs text-muted-foreground" data-testid="publish-reason">{actionDisabledReason ?? 'Nothing new to publish.'}</span>}
          </div>
          {issues.length > 0 && <p className="text-xs text-destructive" data-testid="issue-count">{issues.length} {issues.length === 1 ? 'field needs' : 'fields need'} attention.</p>}
        </div>
      </form>
    </div>

    <aside className="space-y-4" aria-label="About this question">
      {detail
        ? <section className="space-y-3 rounded-xl border border-border p-4" data-testid="summary">
          <StatusChips question={detail} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Source</dt><dd>{originLabel[detail.origin]}</dd>
            <dt className="text-muted-foreground">Topic</dt><dd className="break-words">{topicTitle ?? detail.topicTitle}</dd>
            <dt className="text-muted-foreground">Success rate</dt><dd><SuccessRate rate={detail.successRate} /></dd>
            <dt className="text-muted-foreground">Updated</dt><dd>{dateText(detail.updatedAt, true)}</dd>
          </dl>
          <QuestionFlags question={detail} onChanged={() => void client.invalidateQueries({ queryKey: questionKeys.detail(apis.schoolId, detail.id) })} showNotes />
          {detail.flags.length > 0 && <p className="text-xs text-muted-foreground">Suggestions are advice. They never stop you publishing.</p>}
        </section>
        : <section className="rounded-xl border border-border p-4 text-sm text-muted-foreground">This will be saved as a draft that only you can see. Learners see it after you publish.</section>}
      {detail && <ProvenancePanel question={detail} />}
      {detail && !readOnly && <section className="space-y-2 rounded-xl border border-border p-4" aria-label="More actions" data-testid="more-actions">
        <h2 className="text-base font-bold">More actions</h2>
        {detail.hasDraftRevision && <Button type="button" variant="outline" size="lg" className="w-full justify-start" onClick={() => setConfirm('discard')} disabled={busyNow} data-testid="discard-draft"><Undo2 aria-hidden="true" />Discard draft revision</Button>}
        {detail.status !== 'ARCHIVED' && <Button type="button" variant="outline" size="lg" className="w-full justify-start" onClick={() => setConfirm('archive')} disabled={busyNow} data-testid="archive"><Archive aria-hidden="true" />Archive question</Button>}
        {canDelete && <Button type="button" variant="destructive" size="lg" className="w-full justify-start" onClick={() => setConfirm('delete')} disabled={busyNow} data-testid="delete"><Trash2 aria-hidden="true" />Delete draft</Button>}
        {!canDelete && detail.status === 'DRAFT' && <p className="text-xs text-muted-foreground">Questions that were published or drafted by Co cannot be deleted. Archive them instead.</p>}
      </section>}
    </aside>

    <Dialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null) }}>
      <DialogContent data-testid="confirm-dialog">
        <DialogHeader><DialogTitle>{{ archive: 'Archive this question?', discard: 'Discard the draft revision?', delete: 'Delete this draft?', reject: 'Reject this Co draft?', '': '' }[confirm ?? '']}</DialogTitle>
          <DialogDescription>{{ archive: 'Learners will stop seeing it. Its history is kept and it cannot be changed afterwards.', discard: `Your unpublished changes are removed. Learners keep seeing published version ${detail?.version ?? ''}.`, delete: 'This draft was never published, so it is removed completely.', reject: 'The question is archived with its provenance kept. It is never shown to learners.', '': '' }[confirm ?? '']}</DialogDescription></DialogHeader>
        <DialogBody>{failure && <InlineAlert>{failure}</InlineAlert>}</DialogBody>
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={() => setConfirm(null)}>Keep it</Button>
          <Button variant="destructive" size="lg" disabled={busyNow} data-testid="confirm-action"
            onClick={() => void (confirm === 'archive' ? onArchive() : confirm === 'discard' ? onDiscard() : confirm === 'delete' ? onDelete() : onReview('REJECT'))}>
            {{ archive: 'Archive', discard: 'Discard draft', delete: 'Delete', reject: 'Reject', '': '' }[confirm ?? '']}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
}
