'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, FileDown, Lock } from 'lucide-react'
import { LinkedQuestionsPanel } from '@/components/teacher/materials/linked-questions-panel'
import { TopicMaterialsPanel } from '@/components/teacher/materials/topic-materials-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { LessonBand } from '@/lib/api/teaching/lesson-schema'
import { isDenied, isUnavailable, teachingErrorText } from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { InlineAlert, LoadingBlock, MeasuredTag, UnavailableNote } from './fields'
import { LessonTab } from './lesson-tab'
import { dateText, fromDateInput, toDateInput } from './plan-format'
import { teachingKeys, useTeachingApis, useTeachingContextData } from './use-teaching-apis'

type Tab = 'material' | 'lesson' | 'worksheet'
const tabs: { key: Tab; label: string }[] = [{ key: 'material', label: 'Materials and questions' }, { key: 'lesson', label: 'Lesson' }, { key: 'worksheet', label: 'Worksheet' }]

function DueDate({ planId, topicId, dueAt, revision, readOnly, onSaved }: { planId: string; topicId: string; dueAt: string | null; revision: number; readOnly: boolean; onSaved: (revision: number) => void }) {
  const apis = useTeachingApis()
  const [value, setValue] = useState(toDateInput(dueAt))
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [saved, setSaved] = useState<string | null>(null)
  const changed = value !== toDateInput(dueAt)

  async function save(next: string) {
    setPending(true); setFailure(null); setSaved(null)
    try {
      const result = await apis.topics.update(planId, topicId, { expectedRevision: revision, dueAt: fromDateInput(next) })
      setWarnings(result.warnings ?? []); setSaved(next ? `Due date set to ${dateText(result.topic.dueAt)}.` : 'Due date cleared.')
      setValue(toDateInput(result.topic.dueAt)); onSaved(result.planRevision)
    } catch (error) { setFailure(teachingErrorText(error)) } finally { setPending(false) }
  }
  return <section aria-label="Due date" className="space-y-2" data-testid="due-date">
    <h3 className="flex items-center gap-2 text-base font-bold"><CalendarDays aria-hidden="true" className="size-4" />Due date</h3>
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1"><label htmlFor="topic-due" className="block text-sm font-medium">Students should finish this topic by</label>
        <Input id="topic-due" type="date" value={value} onChange={e => { setValue(e.target.value); setSaved(null) }} className="h-9 w-44" disabled={readOnly || pending} /></div>
      <Button size="lg" onClick={() => void save(value)} disabled={readOnly || pending || !changed || !value} data-testid="save-due">Save date</Button>
      <Button variant="outline" size="lg" onClick={() => void save('')} disabled={readOnly || pending || !dueAt}>Clear date</Button>
    </div>
    <p className="text-xs text-muted-foreground">{dueAt ? <>Currently <MeasuredTag>Set by you</MeasuredTag> {dateText(dueAt)}. Students see it on their plan once it is published.</> : 'No due date set.'}</p>
    {warnings.map(warning => <InlineAlert key={warning} tone="warning" testId="due-warning">{warning}</InlineAlert>)}
    {failure && <InlineAlert>{failure}</InlineAlert>}
    <p role="status" aria-live="polite" className="text-sm">{saved}</p>
  </section>
}

/**
 * T3 right pane / topic page: one topic's materials, linked questions, due date, lesson and worksheet. Everything is fetched
 * from the owner-only topic workspace; a foreign or revoked topic is a plain "not found" with no detail.
 */
export function TopicWorkspacePane({ planId, topicId, targetBand }: { planId: string; topicId: string; targetBand: LessonBand }) {
  const apis = useTeachingApis()
  const client = useQueryClient()
  const context = useTeachingContextData()
  const [tab, setTab] = useState<Tab>('material')
  const key = teachingKeys.topic(apis.schoolId, planId, topicId)
  const query = useQuery({ queryKey: key, queryFn: () => apis.topics.get(planId, topicId), retry: false, staleTime: 0, refetchOnWindowFocus: false })
  const refresh = () => { void client.invalidateQueries({ queryKey: key }); void client.invalidateQueries({ queryKey: teachingKeys.plan(apis.schoolId, planId) }) }
  const photo = context.data ? context.data.features.photoUpload : { available: false, reason: 'Checking whether photos can be stored.' }

  if (query.isPending) return <LoadingBlock label="Loading the topic" />
  if (query.error) {
    return isDenied(query.error)
      ? <InlineAlert testId="topic-denied">This topic was not found, or you no longer have access to it.</InlineAlert>
      : <div className="space-y-3" data-testid="topic-error"><InlineAlert>{isUnavailable(query.error) ? 'The teaching workspace is unavailable right now. Your work is safe; try again.' : teachingErrorText(query.error)}</InlineAlert><Button variant="outline" onClick={() => void query.refetch()}>Retry</Button></div>
  }
  const workspace = query.data
  const archived = workspace.planStatus === 'ARCHIVED'

  return <section aria-label={`Topic: ${workspace.topic.title}`} className="space-y-5" data-testid="topic-workspace">
    <header className="space-y-1">
      <p className="text-xs text-muted-foreground">{workspace.topic.phaseTitle ?? 'Plan'}</p>
      <h2 className="break-words text-xl font-extrabold">{workspace.topic.title}</h2>
      {workspace.topic.description && <p className="break-words text-sm text-muted-foreground">{workspace.topic.description}</p>}
      {workspace.frozen && <p className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="topic-frozen"><Lock aria-hidden="true" className="size-3.5" />This plan is published, so topic names are locked. Materials, lessons and due dates can still change.</p>}
    </header>

    <div role="group" aria-label="Topic sections" className="flex flex-wrap gap-1 border-b border-border pb-2">
      {tabs.map(entry => <button key={entry.key} type="button" aria-pressed={tab === entry.key} onClick={() => setTab(entry.key)} data-testid={`topic-tab-${entry.key}`}
        className={cn('min-h-10 rounded-lg border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', tab === entry.key ? 'border-primary bg-primary/10 text-primary' : 'border-transparent hover:bg-muted')}>{entry.label}</button>)}
    </div>

    {tab === 'material' && <div className="space-y-8">
      <TopicMaterialsPanel planId={planId} topicId={topicId} planStatus={workspace.planStatus} materials={workspace.materials} photo={photo} onChanged={refresh} />
      <LinkedQuestionsPanel planId={planId} questions={workspace.questions} materials={workspace.materials} readOnly={archived} onChanged={refresh} />
      <DueDate planId={planId} topicId={topicId} dueAt={workspace.topic.dueAt} revision={workspace.planRevision} readOnly={archived}
        onSaved={revision => { client.setQueryData(teachingKeys.plan(apis.schoolId, planId), (plan: unknown) => plan && typeof plan === 'object' ? { ...plan, revision } : plan); refresh() }} />
    </div>}
    {tab === 'lesson' && <LessonTab planId={planId} topicId={topicId} workspace={workspace} targetBand={targetBand} onChanged={refresh} />}
    {tab === 'worksheet' && <section aria-label="Worksheet" className="space-y-3 rounded-xl border border-dashed border-border p-5" data-testid="worksheet-panel">
      <h3 className="text-base font-bold">Worksheet</h3>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="lg" disabled aria-disabled="true"><FileDown aria-hidden="true" />Export A4 worksheet</Button>
        <Button variant="outline" size="lg" disabled aria-disabled="true"><Lock aria-hidden="true" />Generate worksheet with Co</Button>
      </div>
      <p className="text-sm font-semibold" data-testid="worksheet-b13">Worksheet export arrives in a later release (B13).</p>
      <UnavailableNote reason={workspace.worksheet.reason} label="Export" testId="worksheet-reason" />
      <UnavailableNote reason={workspace.ai.generateWorksheet.status === 'UNAVAILABLE' ? workspace.ai.generateWorksheet.reason : 'Co drafting for teachers is not available yet.'} label="Generate with Co" testId="worksheet-co-reason" />
    </section>}
  </section>
}
