'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, FilePenLine, Lock, Send, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { lessonVariants, variantLabel, type LessonVariant, type TeachingLessonSummary } from '@/lib/api/teaching/lessons'
import { canonicalLesson, newLesson, type LessonBand } from '@/lib/api/teaching/lesson-schema'
import { teachingErrorText } from '@/lib/api/teaching/plans'
import type { TopicWorkspace } from '@/lib/api/teaching/topics'
import { cn } from '@/lib/utils'
import { InlineAlert, LoadingBlock, UnavailableNote } from './fields'
import { dateText } from './plan-format'
import { useLessonDraft, type DraftSeed } from './lesson-draft'
import { LessonEditor } from './lesson-editor'
import { LessonLintPanel } from './lesson-lint-panel'
import { LessonPreviewPane } from './lesson-preview'
import { LessonPublishDialog } from './lesson-publish-dialog'
import { useTeachingApis } from './use-teaching-apis'

const statusWord = { DRAFT: 'Draft', PUBLISHED: 'Published', SUPERSEDED: 'Replaced' } as const
interface Local { variant: LessonVariant; seed: DraftSeed; saveNow?: boolean }

const saveText = (state: ReturnType<typeof useLessonDraft>['state'], version: number | null, savedAt: Date | null) =>
  state === 'saving' ? 'Saving…' : state === 'saved' ? `Saved${savedAt ? ` at ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}${version ? ` · draft version ${version}` : ''}`
    : state === 'clean' ? `All changes saved${version ? ` · draft version ${version}` : ''}` : state === 'dirty' ? (version ? 'Unsaved changes' : 'Not saved yet. It saves as you write.')
      : state === 'invalid' ? 'Not saved: finish the items below first' : state === 'conflict' ? 'Not saved: changed elsewhere' : 'Not saved: something went wrong'

function DraftEditor({ planId, topicId, variant, seed, saveNow, workspace, targetBand, onChanged, onGone, onNotice }: {
  planId: string; topicId: string; variant: LessonVariant; seed: DraftSeed; saveNow?: boolean; workspace: TopicWorkspace; targetBand: LessonBand; onChanged: () => void; onGone: () => void; onNotice: (message: string) => void
}) {
  const apis = useTeachingApis()
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [publishOpen, setPublishOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [focusStep, setFocusStep] = useState<number | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [saves, setSaves] = useState(0)
  const [previewChoice, setPreviewChoice] = useState<'draft' | 'published'>('draft')
  const draft = useLessonDraft({ api: apis.lessons, planId, topicId, variant, seed, onSaved: () => { setSaves(count => count + 1); onChanged() } })
  const published = workspace.lesson.versions.find(entry => entry.variant === variant && entry.status === 'PUBLISHED') ?? null
  const archived = workspace.planStatus === 'ARCHIVED'
  const started = useRef(false)
  useEffect(() => { if (saveNow && !started.current) { started.current = true; void draft.flush() } }, [saveNow, draft])

  async function preview() {
    const saved = await draft.flush()
    if (!saved && draft.version === null && !published) { setFailure('Finish the items shown above, then the draft can be previewed.'); return }
    setFailure(null); setView('preview')
  }
  async function openPublish() {
    const saved = await draft.flush()
    if (!saved && draft.version === null) { setFailure('Finish the items shown above before publishing.'); return }
    setFailure(null); setPublishOpen(true)
  }
  async function discard() {
    if (draft.revision === null) { draft.markDiscarded(); onGone(); return }
    try { await apis.lessons.deleteDraft(planId, topicId, variant, draft.revision); draft.markDiscarded(); setDiscardOpen(false); onNotice('Draft discarded.'); onChanged(); onGone() }
    catch (error) { setFailure(teachingErrorText(error)) }
  }
  const previewVersion = previewChoice === 'published' && published ? published.version : (draft.version ?? published?.version ?? null)

  return <div className="space-y-4" data-testid="lesson-draft-editor" data-save-state={draft.state}>
    <div className="flex flex-wrap items-center gap-3">
      <p className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold" data-testid="draft-badge">{draft.version ? `Draft v${draft.version}` : 'New draft'}</p>
      {published && <p className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" data-testid="published-badge">Published v{published.version}</p>}
      <p className="text-xs text-muted-foreground">Written by you</p>
      <p role="status" aria-live="polite" className="ms-auto text-sm" data-testid="save-status">{saveText(draft.state, draft.version, draft.savedAt)}</p>
    </div>

    {draft.state === 'conflict' && <InlineAlert tone="warning" testId="lesson-conflict">
      <p className="font-semibold">{draft.error}</p><p>Your edits are still here. Keep them to replace the saved draft, or load the saved draft and lose these edits.</p>
      <div className="mt-2 flex flex-wrap gap-2"><Button size="lg" onClick={() => void draft.keepMine()}>Keep my edits</Button><Button variant="outline" size="lg" onClick={() => void draft.loadSaved()}>Load the saved draft</Button></div>
    </InlineAlert>}
    {draft.state === 'error' && <InlineAlert testId="lesson-save-error"><p>{draft.error} Your edits are still here.</p><Button className="mt-2" variant="outline" size="lg" onClick={() => void draft.retry()}>Try saving again</Button></InlineAlert>}
    {failure && <InlineAlert tone="warning" testId="lesson-action-failure">{failure}</InlineAlert>}

    <div role="group" aria-label="Lesson view" className="flex flex-wrap gap-2">
      <Button variant={view === 'edit' ? 'secondary' : 'outline'} size="lg" aria-pressed={view === 'edit'} onClick={() => setView('edit')}><FilePenLine aria-hidden="true" />Edit</Button>
      <Button variant={view === 'preview' ? 'secondary' : 'outline'} size="lg" aria-pressed={view === 'preview'} onClick={() => void preview()} data-testid="open-preview"><Eye aria-hidden="true" />Preview as student</Button>
      <span className="ms-auto flex gap-2">
        <Button variant="outline" size="lg" onClick={() => setDiscardOpen(true)} disabled={archived}><Trash2 aria-hidden="true" />Discard draft</Button>
        <Button size="lg" onClick={() => void openPublish()} disabled={archived || draft.state === 'saving'} data-testid="publish-lesson"><Send aria-hidden="true" />Publish lesson</Button>
      </span>
    </div>
    {discardOpen && <div role="alertdialog" aria-label="Discard draft" data-testid="discard-confirm" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p>Discard this draft? {published ? `The published version ${published.version} stays as it is for students.` : 'Nothing is published, so students are not affected.'}</p>
      <div className="flex gap-2"><Button variant="destructive" size="lg" onClick={() => void discard()}>Discard</Button><Button variant="outline" size="lg" onClick={() => setDiscardOpen(false)}>Keep editing</Button></div>
    </div>}

    <div hidden={view !== 'edit'} className="space-y-4">
      <LessonEditor content={draft.content} onChange={draft.setContent} issues={draft.issues} focusStep={focusStep} disabled={archived}
        materials={workspace.materials.map(material => ({ id: material.id, title: material.title }))} />
      <LessonLintPanel content={draft.content} targetBand={targetBand} onGoTo={step => { setFocusStep(step); setView('edit') }} />
    </div>
    {view === 'preview' && <div className="space-y-3">
      {published && draft.version !== null && <div role="radiogroup" aria-label="Which version to preview" className="flex gap-2">
        {(['draft', 'published'] as const).map(choice => <button key={choice} type="button" role="radio" aria-checked={previewChoice === choice} onClick={() => setPreviewChoice(choice)}
          className={cn('min-h-9 rounded-lg border px-3 text-sm', previewChoice === choice ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{choice === 'draft' ? `Draft v${draft.version}` : `Published v${published.version}`}</button>)}
      </div>}
      {previewVersion === null ? <InlineAlert tone="info">There is nothing saved to preview yet.</InlineAlert>
        : <LessonPreviewPane planId={planId} topicId={topicId} version={previewVersion} variant={variant} defaultBand={targetBand} refreshKey={saves} />}
    </div>}

    {draft.version !== null && <LessonPublishDialog open={publishOpen} onOpenChange={setPublishOpen} planId={planId} topicId={topicId} variant={variant}
      draft={{ version: draft.version, revision: draft.revision ?? 0, title: draft.content.title || 'Untitled lesson' }} published={published} planStatus={workspace.planStatus} targetBand={targetBand}
      onPublished={changed => { draft.markDiscarded(); setPublishOpen(false); onNotice(changed ? 'Lesson published.' : 'This version was already published.'); onChanged(); onGone() }} />}
  </div>
}

/** Loads the saved draft once, then hands the editor a stable seed so later autosaves never reset what the teacher is typing. */
function SavedDraftLoader({ planId, topicId, variant, summary, ...rest }: { planId: string; topicId: string; variant: LessonVariant; summary: TeachingLessonSummary } & Omit<Parameters<typeof DraftEditor>[0], 'seed' | 'saveNow' | 'variant' | 'planId' | 'topicId'>) {
  const apis = useTeachingApis()
  const query = useQuery({
    queryKey: ['teaching', apis.schoolId, 'lesson-draft', planId, topicId, variant, summary.version], retry: false, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false,
    queryFn: () => apis.lessons.get(planId, topicId, summary.version, variant),
  })
  if (query.isPending) return <LoadingBlock label="Loading your draft" />
  if (query.error) return <div className="space-y-2" data-testid="draft-load-error"><InlineAlert>{teachingErrorText(query.error)}</InlineAlert><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
  const detail = query.data
  return <DraftEditor planId={planId} topicId={topicId} variant={variant} seed={{ content: detail.content, revision: detail.revision, version: detail.version, savedCanonical: canonicalLesson(detail.content) }} {...rest} />
}

/** The Lesson tab of the topic workspace (F-T3-03, F-T3-04 manual part, F-T3-05, F-T3-06). */
export function LessonTab({ planId, topicId, workspace, targetBand, onChanged }: {
  planId: string; topicId: string; workspace: TopicWorkspace; targetBand: LessonBand; onChanged: () => void
}) {
  const apis = useTeachingApis()
  const [variant, setVariant] = useState<LessonVariant>('STANDARD')
  const [local, setLocal] = useState<Local | null>(null)
  const [session, setSession] = useState(0)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const all = workspace.lesson.versions
  const versions = all.filter(entry => entry.variant === variant)
  const draft = versions.find(entry => entry.status === 'DRAFT') ?? null
  const published = versions.find(entry => entry.status === 'PUBLISHED') ?? null
  const hasLocal = local !== null && local.variant === variant
  const archived = workspace.planStatus === 'ARCHIVED'
  const variantsPresent = lessonVariants.filter(entry => all.some(version => version.variant === entry))
  const standardExists = all.some(entry => entry.variant === 'STANDARD')
  const gone = () => { setLocal(null); setSession(count => count + 1) }

  async function copyAs(target: 'EASIER' | 'HARDER') {
    setBusy(true); setFailure(null)
    try { await apis.lessons.duplicateAs(planId, topicId, target); setVariant(target); onChanged() } catch (error) { setFailure(teachingErrorText(error)) } finally { setBusy(false) }
  }
  async function fromVersion(version: TeachingLessonSummary) {
    setBusy(true); setFailure(null)
    try {
      const detail = await apis.lessons.get(planId, topicId, version.version, version.variant)
      setVariant(version.variant)
      setLocal({ variant: version.variant, saveNow: true, seed: { content: detail.content, revision: null, version: null, baseVersion: version.version, savedCanonical: null } })
      setSession(count => count + 1)
    } catch (error) { setFailure(teachingErrorText(error)) } finally { setBusy(false) }
  }

  const aiLesson = workspace.ai.generateLesson
  const aiDiff = workspace.ai.differentiate
  const reason = (state: typeof aiLesson) => state.status === 'UNAVAILABLE' ? state.reason : 'Co drafting for teachers is not available yet.'

  return <section aria-label="Lesson" className="space-y-5" data-testid="lesson-tab">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-base font-bold">Lesson</h3>
      {variantsPresent.length > 1 && <div role="radiogroup" aria-label="Lesson version type" className="flex gap-1">
        {variantsPresent.map(entry => <button key={entry} type="button" role="radio" aria-checked={variant === entry} onClick={() => { setVariant(entry); gone() }}
          className={cn('min-h-9 rounded-lg border px-3 text-sm', variant === entry ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{variantLabel[entry]}</button>)}
      </div>}
    </div>
    {variant !== 'STANDARD' && <InlineAlert tone="info">This copy is for you to keep. Students are given the standard lesson in this release; choosing who gets an easier or harder copy comes later.</InlineAlert>}
    {failure && <InlineAlert testId="lesson-tab-failure">{failure}</InlineAlert>}
    <p role="status" aria-live="polite" data-testid="lesson-notice" className={notice ? 'text-sm font-medium' : 'sr-only'}>{notice ?? ''}</p>

    {hasLocal || draft
      ? (hasLocal
        ? <DraftEditor key={`${variant}:${session}`} planId={planId} topicId={topicId} variant={variant} seed={local!.seed} saveNow={local!.saveNow} workspace={workspace} targetBand={targetBand} onChanged={onChanged} onGone={gone} onNotice={setNotice} />
        : <SavedDraftLoader key={`${variant}:${session}:${draft!.version}`} planId={planId} topicId={topicId} variant={variant} summary={draft!} workspace={workspace} targetBand={targetBand} onChanged={onChanged} onGone={gone} onNotice={setNotice} />)
      : <div className="space-y-4" data-testid="lesson-no-draft">
        {published ? <div className="space-y-3 rounded-xl border border-border p-4" data-testid="lesson-published-card">
          <p className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary w-fit">Published v{published.version}</p>
          <p className="break-words font-bold">{published.title}</p>
          <p className="text-sm text-muted-foreground">{published.stepCount} {published.stepCount === 1 ? 'step' : 'steps'} · published {dateText(published.publishedAt)}. Published versions cannot be edited; start a new version to change it.</p>
          <Button size="lg" onClick={() => void fromVersion(published)} disabled={busy || archived} data-testid="edit-as-new-draft"><FilePenLine aria-hidden="true" />Edit as a new draft</Button>
        </div> : <div className="rounded-xl border border-dashed border-border p-6 text-center" data-testid="lesson-empty">
          <h4 className="font-bold">No {variant === 'STANDARD' ? '' : `${variantLabel[variant].toLowerCase()} `}lesson yet</h4>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Write the lesson step by step. It saves as you go, and students see nothing until you publish it.</p>
          <Button className="mt-3" size="lg" disabled={archived} onClick={() => { setLocal({ variant, seed: { content: newLesson(''), revision: null, version: null, savedCanonical: null } }); setSession(count => count + 1) }} data-testid="start-lesson">Start a lesson</Button>
        </div>}
      </div>}

    {versions.length > 0 && <section aria-label="Lesson versions" className="space-y-2" data-testid="lesson-versions">
      <h4 className="text-sm font-bold">Versions</h4>
      <ul className="space-y-1">{[...all].sort((a, b) => a.variant === b.variant ? b.version - a.version : a.variant.localeCompare(b.variant)).map(entry => <li key={`${entry.variant}:${entry.version}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm" data-testid="lesson-version-row" data-status={entry.status}>
        <span className="font-semibold">{variantLabel[entry.variant]} v{entry.version}</span>
        <span className={cn('rounded-full border px-2 text-xs font-semibold', entry.status === 'PUBLISHED' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border')}>{statusWord[entry.status]}</span>
        <span className="text-xs text-muted-foreground">{entry.stepCount} {entry.stepCount === 1 ? 'step' : 'steps'} · {entry.status === 'PUBLISHED' ? `published ${dateText(entry.publishedAt)}` : `updated ${dateText(entry.updatedAt)}`} · {entry.authoredByMe ? 'written by you' : 'written by another teacher'}</span>
        {entry.status !== 'DRAFT' && <Button className="ms-auto" variant="outline" size="lg" disabled={busy || archived || all.some(other => other.variant === entry.variant && other.status === 'DRAFT') || (hasLocal && local!.variant === entry.variant)} onClick={() => void fromVersion(entry)}>Use as new draft</Button>}
      </li>)}</ul>
      {all.some(entry => entry.status === 'DRAFT') && <p className="text-xs text-muted-foreground">To use an older version, finish or discard the current draft of that kind first.</p>}
    </section>}

    <section aria-label="More ways to make this lesson" className="space-y-3 rounded-xl border border-border p-4" data-testid="lesson-extras">
      <h4 className="text-sm font-bold">More ways to make this lesson</h4>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1" data-testid="co-generate-lesson"><Button variant="outline" size="lg" disabled aria-disabled="true"><Lock aria-hidden="true" />Generate lesson with Co</Button><UnavailableNote reason={reason(aiLesson)} testId="co-generate-lesson-reason" label="Unavailable" /></div>
        <div className="space-y-1" data-testid="co-differentiate"><Button variant="outline" size="lg" disabled aria-disabled="true"><Lock aria-hidden="true" />Make easier or harder with Co</Button><UnavailableNote reason={reason(aiDiff)} testId="co-differentiate-reason" label="Unavailable" /></div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Write your own easier or harder copy</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" disabled={busy || !standardExists || archived || all.some(entry => entry.variant === 'EASIER' && entry.status === 'DRAFT')} onClick={() => void copyAs('EASIER')} data-testid="copy-easier">Make an easier copy</Button>
          <Button variant="outline" size="lg" disabled={busy || !standardExists || archived || all.some(entry => entry.variant === 'HARDER' && entry.status === 'DRAFT')} onClick={() => void copyAs('HARDER')} data-testid="copy-harder">Make a harder copy</Button>
        </div>
        <p className="text-xs text-muted-foreground">{standardExists ? 'This copies the standard lesson into a draft for you to rewrite by hand.' : 'Write the standard lesson first.'}</p>
      </div>
    </section>
  </section>
}
