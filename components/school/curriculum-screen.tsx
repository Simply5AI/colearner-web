'use client'
import { useState } from 'react'
import { BookMarked, Layers, Library } from 'lucide-react'
import { Card, EmptyState, Select } from '@/components/design-system'
import { boards, catalogSchema, coverageSchema, curriculumPaths, statusLabels, type Catalog, type Coverage, type CoverageStatus, type CurriculumBoard } from '@/lib/api/curriculum'
import { QueryState, SchoolHeading } from './school-common'
import { ClassContent } from './curriculum-class'
import { useCurriculumData } from './curriculum-common'

const statusStyle: Record<CoverageStatus, string> = {
  COVERED: 'border-success text-success',
  PARTIAL: 'border-warning text-warning',
  NOT_LOADED: 'border-border text-muted-foreground',
}
export const StatusBadge = ({ status }: { status: CoverageStatus }) => <span data-status={status} className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-sm font-bold ${statusStyle[status]}`}>{statusLabels[status]}</span>

const reviewedOn = (value: string | null) => (value ? new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—')

function CoverageReport({ schoolId }: { schoolId: string }) {
  const coverage = useCurriculumData<Coverage>(schoolId, curriculumPaths.coverage(), coverageSchema)
  const [board, setBoard] = useState('')
  const [grade, setGrade] = useState('')
  const all = coverage.data?.rows ?? []
  const rows = all.filter(row => (!board || row.board === board) && (!grade || row.grade === Number(grade)))
  const counts = all.reduce<Record<CoverageStatus, number>>((sums, row) => ({ ...sums, [row.status]: sums[row.status] + 1 }), { COVERED: 0, PARTIAL: 0, NOT_LOADED: 0 })
  const total = all.length
  // The platform reports one NOT_LOADED row per board and class that has nothing published, so "empty" means nothing is loaded at all.
  const nothingLoaded = all.every(row => row.status === 'NOT_LOADED')
  return <Card className="space-y-5" aria-labelledby="coverage-heading" role="region">
    <div className="flex items-start gap-3"><Layers aria-hidden="true" className="mt-1 shrink-0" /><div><h2 id="coverage-heading" className="text-xl font-bold">Coverage report</h2><p className="text-muted-foreground">What the central catalog actually holds for each board, class and subject. A board name alone never means a class has full curriculum content.</p></div></div>
    <QueryState pending={coverage.isPending} error={coverage.error} retry={() => void coverage.refetch()}>
      {nothingLoaded
        ? <EmptyState band="adults" title="No curriculum is loaded yet" description={<>Status: <StatusBadge status="NOT_LOADED" /> The central catalog has no reviewed CBSE or ICSE subjects. No chapters or topics are shown or assumed. Platform staff load reviewed content with the import tool.</>} />
        : <>
          {coverage.data?.notice && <p role="note" className="text-sm text-muted-foreground">{coverage.data.notice}</p>}
          <p role="status" className="text-sm"><strong>{counts.COVERED}</strong> covered · <strong>{counts.PARTIAL}</strong> partial · <strong>{counts.NOT_LOADED}</strong> not loaded <span className="text-muted-foreground">({total} catalog rows)</span></p>
          <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
            <Select label="Filter by board" value={board} onChange={event => setBoard(event.target.value)}><option value="">All boards</option>{boards.map(item => <option key={item} value={item}>{item}</option>)}</Select>
            <Select label="Filter by class" value={grade} onChange={event => setGrade(event.target.value)}><option value="">All classes</option>{Array.from({ length: 10 }, (_, index) => index + 1).map(item => <option key={item} value={item}>Class {item}</option>)}</Select>
          </div>
          {rows.length === 0
            ? <p>No catalog rows match this filter.</p>
            : <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[56rem] text-start text-sm">
                  <caption className="sr-only">Curriculum coverage by board, class and subject</caption>
                  <thead className="bg-muted text-start"><tr>{['Board', 'Class', 'Subject', 'Chapters', 'Topics', 'Version', 'Source', 'Reviewer', 'Status'].map(heading => <th key={heading} scope="col" className="px-3 py-2 text-start font-bold">{heading}</th>)}</tr></thead>
                  <tbody>{rows.map(row => <tr key={`${row.board}-${row.grade}-${row.subjectKey ?? 'none'}`} className="border-t border-border align-top">
                    <td className="px-3 py-2">{row.board}</td><td className="px-3 py-2">{row.grade}</td><th scope="row" className="px-3 py-2 text-start font-semibold">{row.subjectName ?? <span className="font-normal text-muted-foreground">No subject loaded</span>}</th>
                    <td className="px-3 py-2">{row.subjectName ? row.chapterCount : '—'}</td><td className="px-3 py-2">{row.subjectName ? row.topicCount : '—'}</td>
                    <td className="px-3 py-2">{row.versionLabel ?? '—'}</td><td className="max-w-56 break-words px-3 py-2">{row.sourceTitle ?? '—'}</td>
                    <td className="px-3 py-2">{row.reviewerName ? <>{row.reviewerName}<span className="block text-muted-foreground">{reviewedOn(row.reviewedAt)}</span></> : '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                  </tr>)}</tbody>
                </table>
              </div>}
        </>}
    </QueryState>
  </Card>
}

function CatalogBrowser({ schoolId }: { schoolId: string }) {
  const [board, setBoard] = useState<CurriculumBoard>('CBSE')
  const [grade, setGrade] = useState(1)
  const catalog = useCurriculumData<Catalog>(schoolId, curriculumPaths.catalog(board, grade), catalogSchema)
  const subjects = catalog.data?.subjects ?? []
  return <Card className="space-y-5" role="region" aria-labelledby="catalog-heading">
    <div className="flex items-start gap-3"><Library aria-hidden="true" className="mt-1 shrink-0" /><div><h2 id="catalog-heading" className="text-xl font-bold">Catalog browser</h2><p className="text-muted-foreground">Browse the reviewed central catalog by subject, chapter and topic. It is read-only here; schools cannot edit central content.</p></div></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
      <Select label="Catalog board" value={board} onChange={event => setBoard(event.target.value as CurriculumBoard)}>{boards.map(item => <option key={item} value={item}>{item}</option>)}</Select>
      <Select label="Catalog class" value={grade} onChange={event => setGrade(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map(item => <option key={item} value={item}>Class {item}</option>)}</Select>
    </div>
    <QueryState pending={catalog.isPending} error={catalog.error} retry={() => void catalog.refetch()}>
      {subjects.length === 0
        ? <EmptyState band="adults" title={`${board} Class ${grade}: not loaded`} description="The central catalog has no reviewed subjects for this board and class. Nothing is assumed from the board name." />
        : <><p role="note" className="text-sm text-muted-foreground">{catalog.data?.notice}</p><ul className="space-y-3">{subjects.map(subject => <li key={subject.id}>
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-bold" style={{ minHeight: 'var(--ds-target)' }}>{subject.name} <span className="font-normal text-muted-foreground">· {subject.chapterCount} chapters · {subject.topicCount} topics · {subject.version.label}</span></summary>
              <p className="mt-2 text-sm text-muted-foreground">Source: {subject.version.sourceTitle}{subject.version.reviewerName ? ` · Reviewed by ${subject.version.reviewerName}` : ''}</p>
              {!subject.chapters || subject.chapters.length === 0 ? <p className="mt-3">This subject is listed with no chapters loaded.</p> : <ol className="mt-3 space-y-3">{subject.chapters.map(chapter => <li key={chapter.id}><p className="font-semibold">{chapter.ordinal}. {chapter.title}</p>{chapter.topics.length > 0 && <ul className="ms-6 list-disc">{chapter.topics.map(topic => <li key={topic.id}>{topic.title}</li>)}</ul>}</li>)}</ol>}
            </details>
          </li>)}</ul></>}
    </QueryState>
  </Card>
}

/**
 * S5 — provisional functional UI. No school-admin design has been supplied (S5 spec,
 * "Design completeness"); this uses the shared B01 system until one is.
 */
export function CurriculumScreen({ schoolId }: { schoolId: string }) {
  return <div className="space-y-8">
    <SchoolHeading title="Curriculum & subject mapping" description="See what curriculum is actually loaded, map subjects to your classes and assign reviewed content. Subjects, plans and materials are never inferred from a board name." />
    <p role="note" className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm"><BookMarked aria-hidden="true" className="mt-0.5 shrink-0" size={18} />Provisional screen: it uses the shared design system while a school-admin design is still to be supplied. Behaviour and data are real; layout may change.</p>
    <CoverageReport schoolId={schoolId} />
    <CatalogBrowser schoolId={schoolId} />
    <ClassContent schoolId={schoolId} />
  </div>
}

