'use client'
import { useEffect, useState } from 'react'
import { Button, Card, Checkbox, EmptyState, Input, LoadingState, Select } from '@/components/design-system'
import { assignmentKinds, catalogSchema, classAssignmentInputSchema, classAssignmentsSchema, classSubjectsSchema, curriculumPaths, dueDateToIso, type AssignmentKind, type Catalog, type ClassAssignmentPage, type ClassSubjects as ClassSubjectsView } from '@/lib/api/curriculum'
import { classLabel, type CursorList, type Paged, type SchoolClass, type SchoolMember } from '@/lib/api/school'
import { ActionFeedback, QueryState, useSchoolData } from './school-common'
import { useCurriculumAction, useCurriculumData } from './curriculum-common'

type Mapping = Record<string, string>

function ClassSubjects({ schoolId, schoolClass }: { schoolId: string; schoolClass: SchoolClass }) {
  const mapped = useCurriculumData<ClassSubjectsView>(schoolId, curriculumPaths.classSubjects(schoolClass.id), classSubjectsSchema)
  const members = useSchoolData<CursorList<SchoolMember>>(schoolId, '/memberships')
  const action = useCurriculumAction(schoolId)
  const [draft, setDraft] = useState<Mapping | null>(null)
  const server: Mapping = Object.fromEntries((mapped.data?.items ?? []).map(item => [item.curriculumSubjectId, item.teacherUserId ?? '']))
  // Seed the editable draft once per server version; an unsaved or failed draft is never overwritten.
  useEffect(() => { if (mapped.data && draft === null) setDraft(server) }, [mapped.data, draft]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = draft ?? server
  const dirty = JSON.stringify(Object.entries(current).sort()) !== JSON.stringify(Object.entries(server).sort())
  const teachers = members.data?.items.filter(item => item.role === 'TEACHER' && item.status === 'ACTIVE') ?? []
  // The server only accepts published subjects for this class's board and grade (`available`); a mapped subject outside that set stays visible so it can be removed.
  const available = mapped.data?.available ?? []
  const known = new Set(available.map(item => item.curriculumSubjectId))
  const orphaned = (mapped.data?.items ?? []).filter(item => !known.has(item.curriculumSubjectId))
  const toggle = (subjectId: string, on: boolean) => setDraft(old => { const next = { ...(old ?? server) }; if (on) next[subjectId] = next[subjectId] ?? ''; else delete next[subjectId]; return next })
  const save = () => action.mutate({
    suffix: curriculumPaths.classSubjects(schoolClass.id), method: 'PUT',
    body: { subjects: Object.entries(current).map(([curriculumSubjectId, teacherUserId]) => ({ curriculumSubjectId, ...(teacherUserId ? { teacherUserId } : {}) })) },
  }, { onSuccess: () => setDraft(null) })
  return <section aria-labelledby="class-subjects-heading" className="space-y-4">
    <h3 id="class-subjects-heading" className="text-lg font-bold">Subjects for {classLabel(schoolClass)}</h3>
    <QueryState pending={mapped.isPending} error={mapped.error} retry={() => void mapped.refetch()}>
      {available.length === 0 && orphaned.length === 0
        ? <EmptyState band="adults" title="No curriculum subjects to map" description={`The central catalog has no reviewed ${schoolClass.board} Class ${schoolClass.grade} subjects (not loaded), so there is nothing to map for this class yet.`} />
        : <>
          {mapped.data?.notice && <p role="note" className="text-sm text-muted-foreground">{mapped.data.notice}</p>}
          <ul className="space-y-3">
            {available.map(subject => {
              const on = subject.curriculumSubjectId in current
              return <li key={subject.curriculumSubjectId} className="grid items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-2">
                <Checkbox label={<span className="font-semibold">{subject.name}<span className="block text-sm font-normal text-muted-foreground">{subject.chapterCount} chapters · {subject.topicCount} topics · {subject.versionLabel}</span></span>} checked={on} onChange={event => toggle(subject.curriculumSubjectId, event.target.checked)} />
                {on && <Select label={`Teacher for ${subject.name} (optional)`} value={current[subject.curriculumSubjectId] ?? ''} onChange={event => setDraft(old => ({ ...(old ?? server), [subject.curriculumSubjectId]: event.target.value }))}><option value="">No teacher yet</option>{teachers.map(teacher => <option key={teacher.id} value={teacher.userId}>{teacher.name}</option>)}</Select>}
              </li>
            })}
            {orphaned.map(item => <li key={item.curriculumSubjectId} className="rounded-xl border border-dashed border-border p-3"><Checkbox label={<span>{item.name} <span className="text-sm text-muted-foreground">(no longer in the catalog for this class)</span></span>} checked={item.curriculumSubjectId in current} onChange={event => toggle(item.curriculumSubjectId, event.target.checked)} /></li>)}
          </ul>
          {members.error && <p role="alert" className="text-sm text-destructive">Teachers could not be loaded; subjects can still be mapped without a teacher. <Button variant="ghost" onClick={() => void members.refetch()}>Retry teachers</Button></p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button loading={action.isPending} disabled={!dirty} onClick={save}>Save subject mapping</Button>
            {dirty && <Button variant="ghost" disabled={action.isPending} onClick={() => setDraft(null)}>Discard changes</Button>}
            {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
          </div>
          <ActionFeedback pending={false} error={action.error} success={action.isSuccess && !dirty} />
        </>}
    </QueryState>
  </section>
}

function ClassAssignments({ schoolId, schoolClass }: { schoolId: string; schoolClass: SchoolClass }) {
  const list = useCurriculumData<ClassAssignmentPage>(schoolId, curriculumPaths.assignmentList(schoolClass.id), classAssignmentsSchema)
  const catalog = useCurriculumData<Catalog>(schoolId, curriculumPaths.catalog(schoolClass.board, schoolClass.grade), catalogSchema)
  const assigned = list.data?.items ?? []
  const action = useCurriculumAction(schoolId)
  const [kind, setKind] = useState<AssignmentKind>('PLAN')
  const [refId, setRefId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [due, setDue] = useState('')
  const [problem, setProblem] = useState('')
  const [confirming, setConfirming] = useState('')
  const topics = (catalog.data?.subjects ?? []).flatMap(subject => (subject.chapters ?? []).flatMap(chapter => chapter.topics.map(topic => ({ id: topic.id, label: `${subject.name} · ${chapter.title} · ${topic.title}` }))))
  const reference = kind === 'CENTRAL_TOPIC' ? topicId : refId.trim()
  const submit = () => {
    const parsed = classAssignmentInputSchema.safeParse({ kind, refId: reference, ...(due ? { dueAt: dueDateToIso(due) } : {}) })
    if (!parsed.success) { setProblem(kind === 'CENTRAL_TOPIC' ? 'Choose a topic from the catalog.' : 'Enter the plan or material ID exactly as it was issued (a UUID such as 3f2b8c1e-5a4d-4e7b-9c10-2d6f8a1b3c4e).'); return }
    // The platform makes a repeat of the same content idempotent and only moves its due date, so only a repeat that would change nothing is stopped here.
    const existing = assigned.find(item => item.kind === parsed.data.kind && item.refId === parsed.data.refId)
    if (existing && (!parsed.data.dueAt || (existing.dueAt !== null && new Date(existing.dueAt).getTime() === new Date(parsed.data.dueAt).getTime()))) { setProblem('This is already assigned to the class. Choose a different due date to move it, or remove it first.'); return }
    setProblem('')
    action.mutate({ suffix: curriculumPaths.assignments(schoolClass.id), method: 'POST', body: parsed.data }, { onSuccess: () => { setRefId(''); setTopicId(''); setDue('') } })
  }
  return <section aria-labelledby="class-assignments-heading" className="space-y-4">
    <h3 id="class-assignments-heading" className="text-lg font-bold">Content assigned to {classLabel(schoolClass)}</h3>
    <QueryState pending={list.isPending} error={list.error} retry={() => void list.refetch()}>
      {assigned.length === 0
        ? <p>Nothing has been assigned to this class yet.</p>
        : <><ul className="space-y-2">{assigned.map(item => <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0 flex-1"><p className="break-words font-semibold">{item.title ?? 'Content no longer available'}</p><p className="text-sm text-muted-foreground">{assignmentKinds.find(entry => entry.value === item.kind)?.label}{item.dueAt ? ` · due ${new Date(item.dueAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}` : ' · no due date'}{item.available ? '' : ' · the plan, material or topic was unpublished or removed'}</p></div>
            {confirming === item.id
              ? <><Button variant="secondary" loading={action.isPending} onClick={() => action.mutate({ suffix: curriculumPaths.assignment(schoolClass.id, item.id), method: 'DELETE' }, { onSuccess: () => setConfirming('') })}>Confirm remove</Button><Button variant="ghost" onClick={() => setConfirming('')}>Keep</Button></>
              : <Button variant="ghost" aria-label={`Remove ${item.title ?? item.refId}`} onClick={() => setConfirming(item.id)}>Remove</Button>}
          </li>)}</ul>{(list.data?.total ?? 0) > assigned.length && <p className="text-sm text-muted-foreground">Showing the {assigned.length} most recent of {list.data?.total} assignments.</p>}</>}
    </QueryState>
    <form className="space-y-4 border-t border-border pt-4" onSubmit={event => { event.preventDefault(); submit() }}>
      <h4 className="font-bold">Assign content</h4>
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="What to assign" value={kind} onChange={event => { setKind(event.target.value as AssignmentKind); setProblem('') }}>{assignmentKinds.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
        {kind === 'CENTRAL_TOPIC'
          ? (catalog.isPending ? <LoadingState label="Loading catalog topics…" /> : <Select label="Central topic" value={topicId} onChange={event => { setTopicId(event.target.value); setProblem('') }}><option value="">{topics.length ? 'Choose a topic' : 'No topics are loaded for this class'}</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</Select>)
          : <Input label={kind === 'PLAN' ? 'Plan ID' : 'Material ID'} value={refId} maxLength={128} hint="Paste the ID of a published plan or one of its materials. The server checks that it belongs to your school." onChange={event => { setRefId(event.target.value); setProblem('') }} />}
        <Input label="Due date (optional)" type="date" value={due} onChange={event => setDue(event.target.value)} />
      </div>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <Button type="submit" loading={action.isPending && action.variables?.method === 'POST'}>Assign to class</Button>
      <ActionFeedback pending={false} error={action.error} success={action.isSuccess && !problem} />
    </form>
  </section>
}

/** Class → subject mapping and class content assignment share one class selection. */
export function ClassContent({ schoolId }: { schoolId: string }) {
  const classes = useSchoolData<Paged<SchoolClass>>(schoolId, '/classes?page=1&pageSize=100')
  const [classId, setClassId] = useState('')
  const active = (classes.data?.items ?? []).filter(item => !item.archivedAt)
  const selected = active.find(item => item.id === classId)
  return <Card className="space-y-6" role="region" aria-labelledby="class-content-heading">
    <div><h2 id="class-content-heading" className="text-xl font-bold">Class subjects and content</h2><p className="text-muted-foreground">Choose a class to map its subjects and assign plans, materials or central topics. Assignments appear in each student’s learning home.</p></div>
    <QueryState pending={classes.isPending} error={classes.error} retry={() => void classes.refetch()}>
      {active.length === 0
        ? <EmptyState band="adults" title="No active classes" description="Create classes under Academic structure first." />
        : <Select label="Class to manage" value={classId} onChange={event => setClassId(event.target.value)}><option value="">Choose a class</option>{active.map(item => <option key={item.id} value={item.id}>{classLabel(item)}</option>)}</Select>}
    </QueryState>
    {selected && <div className="space-y-8" key={selected.id}><ClassSubjects schoolId={schoolId} schoolClass={selected} /><ClassAssignments schoolId={schoolId} schoolClass={selected} /></div>}
  </Card>
}
