'use client'

import '@/styles/print-a4.css'
import Link from 'next/link'
import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTeachingApis } from '@/components/teacher/plans/use-teaching-apis'
import { useB13Apis } from './use-b13-apis'
import { FailureBlock, LoadingBlock } from './states'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { formatCorrectAnswer, totalPoints, type AnswerKeyItem, type StudentItem } from '@/lib/api/teaching/worksheets'

/*
 * The A4 student page (`mode="student"`) and the teacher answer key (`mode="answer-key"`). They are separate routes that call
 * separate render endpoints. The student page is built from `studentRenderSchema`, which strips answer-key fields, so nothing
 * here can show an answer on the student sheet. Print uses the browser (`window.print()`), styled by styles/print-a4.css.
 */
export type DocumentMode = 'student' | 'answer-key'

const letter = (index: number) => String.fromCharCode(65 + index)
const pointsText = (points: number) => (points === 1 ? '1 mark' : `${points} marks`)

function Lines({ n }: { n: number }) {
  if (n <= 0) return null
  return <div className="ws-lines" aria-hidden="true" data-testid="ws-lines">{Array.from({ length: n }, (_, index) => <div key={index} className="ws-line" />)}</div>
}

function Options({ item, urls }: { item: StudentItem; urls: Record<string, string | 'failed' | undefined> }) {
  const options = item.options ?? []
  if (options.length === 0) return null
  if (item.type === 'PICTURE_CHOICE') {
    return <ul className="ws-pictures" data-testid="ws-pictures">{options.map((option, index) => {
      const materialId = item.media?.optionImages?.[option.id]
      const url = materialId ? urls[materialId] : undefined
      return <li key={option.id} className="ws-pic"><span className="flex items-baseline gap-2" style={{ display: 'flex', gap: '2.5mm', alignItems: 'baseline' }}><span className="ws-box" aria-hidden="true" /><span>{letter(index)}. {option.label}</span></span>
        {url && url !== 'failed' ? <img src={url} alt={option.label || `Picture ${letter(index)}`} /> : <span className="ws-pic-fallback">{url === 'failed' ? 'Picture could not be loaded' : 'Loading picture'}</span>}</li>
    })}</ul>
  }
  if (item.type === 'ORDERING') {
    return <ul className="ws-options" data-testid="ws-ordering">{options.map(option => <li key={option.id}><span className="ws-order-box" aria-hidden="true" /><span>{option.label}</span></li>)}</ul>
  }
  const square = item.type === 'MULTI_SELECT'
  return <ul className="ws-options" data-testid="ws-options">{options.map((option, index) => <li key={option.id}><span className={`ws-box${square ? ' ws-square' : ''}`} aria-hidden="true" /><span>{letter(index)}. {option.label}</span></li>)}</ul>
}

function Question({ item, mode, showHints, urls }: { item: StudentItem | AnswerKeyItem; mode: DocumentMode; showHints: boolean; urls: Record<string, string | 'failed' | undefined> }) {
  const key = mode === 'answer-key' ? (item as AnswerKeyItem) : null
  const longLines = item.type === 'LONG_ANSWER' ? Math.min(12, item.answerLines * 2) : item.answerLines
  const writes = ['SHORT_ANSWER', 'LONG_ANSWER', 'CODE', 'FILL_BLANK'].includes(item.type)
  return <li className="ws-q" data-testid="ws-question" data-number={item.number} data-type={item.type}>
    <div className="ws-q-head"><span className="ws-num">{item.number}.</span><span className="ws-prompt">{item.prompt}</span><span className="ws-pts">[{pointsText(item.points)}]</span></div>
    {item.type === 'MULTI_SELECT' && <p className="ws-note">Select all that apply.</p>}
    {item.type === 'ORDERING' && <p className="ws-note">Write 1 to {item.options?.length ?? ''} in the boxes to put these in the correct order.</p>}
    {item.type === 'CODE' && item.media?.starterCode && <pre className="ws-code">{item.media.starterCode}</pre>}
    {!key && showHints && item.hints && item.hints.length > 0 && <p className="ws-note" data-testid="ws-hint">Hint: {item.hints.map(hint => hint.text).join(' ')}</p>}
    {!key && <Options item={item} urls={urls} />}
    {!key && writes && <Lines n={item.type === 'FILL_BLANK' ? Math.min(item.answerLines, 2) : longLines} />}
    {key && <>
      <Options item={item} urls={urls} />
      <div className="ws-answer" data-testid="ws-answer">
        <p><span className="ws-label">Answer:</span></p>
        {formatCorrectAnswer(key).map((line, index) => <p key={index} style={{ whiteSpace: 'pre-wrap' }}>{line}</p>)}
        {key.rubric && <p><span className="ws-label">Marking guide:</span> {key.rubric}</p>}
        {key.explanation && <p><span className="ws-label">Why:</span> {key.explanation}</p>}
      </div>
    </>}
  </li>
}

export function WorksheetDocument({ planId, worksheetId, mode }: { planId: string; worksheetId: string; mode: DocumentMode }) {
  const apis = useB13Apis()
  const materials = useTeachingApis().materials
  const query = useQuery({
    queryKey: ['b13', apis.schoolId, 'render', worksheetId, mode],
    queryFn: () => (mode === 'student' ? apis.worksheets.renderStudent(worksheetId) : apis.worksheets.renderAnswerKey(worksheetId)),
    retry: false, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
  })
  const render = query.data
  const materialIds = useMemo(() => [...new Set((render?.items ?? []).flatMap(item => Object.values(item.media?.optionImages ?? {})))], [render])
  const images = useQueries({ queries: materialIds.map(materialId => ({
    queryKey: ['b13', apis.schoolId, 'image', planId, materialId], queryFn: async () => (await materials.downloadUrl(planId, materialId)).url,
    retry: false, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false,
  })) })
  const urls = useMemo(() => Object.fromEntries(materialIds.map((materialId, index) => [materialId, images[index]?.isError ? 'failed' : images[index]?.data])), [materialIds, images])
  const picturesPending = images.some(image => image.isPending)
  const builderHref = `/teacher/plans/${encodeURIComponent(planId)}/worksheets/${encodeURIComponent(worksheetId)}`
  const otherHref = `${builderHref}/${mode === 'student' ? 'answer-key' : 'print'}`

  if (query.isPending) return <LoadingBlock label="Preparing the worksheet" testId="ws-doc-loading" />
  if (query.isError || !render) return <div className="space-y-3"><FailureBlock error={query.error} onRetry={() => void query.refetch()} subject="this worksheet" testId="ws-doc-failure" /><Button asChild variant="outline" size="lg"><Link href={`/teacher/plans/${encodeURIComponent(planId)}/worksheets`}>Back to worksheets</Link></Button></div>

  const { worksheet, items } = render
  const isKey = mode === 'answer-key'
  return <div className="space-y-4" data-testid="ws-document" data-mode={mode}>
    <div className="ws-no-print space-y-3" data-testid="ws-toolbar">
      <Button asChild variant="ghost" size="lg" className="-ms-2"><Link href={builderHref}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />Back to worksheet</Link></Button>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" onClick={() => window.print()} disabled={picturesPending || items.length === 0} aria-disabled={picturesPending || items.length === 0} data-testid="ws-print"><Printer aria-hidden="true" />{isKey ? 'Print the answer key' : 'Print or save as PDF'}</Button>
        <Button asChild variant="outline" size="lg" data-testid="ws-switch"><Link href={otherHref}>{isKey ? 'Student worksheet' : <><KeyRound aria-hidden="true" />Answer key</>}</Link></Button>
        <span className="text-sm text-muted-foreground">A4 · {worksheet.status === 'FINAL' ? 'Final' : worksheet.status === 'ARCHIVED' ? 'Archived' : 'Draft preview'}</span>
      </div>
      {picturesPending && <p role="status" className="text-sm text-muted-foreground">Pictures are still loading. Printing is available once they appear.</p>}
      {items.length === 0 && <InlineAlert tone="info">This worksheet has no questions yet. Add some in the builder first.</InlineAlert>}
      {worksheet.status === 'DRAFT' && <InlineAlert tone="info" testId="ws-draft-note">This is a draft. Finalise the worksheet to freeze the questions before you hand it out.</InlineAlert>}
      {isKey && <InlineAlert tone="warning" testId="ws-key-warning">This page shows the answers. Do not give it to students. Print it separately from the student worksheet.</InlineAlert>}
    </div>

    <article className="ws-sheet" data-testid="ws-sheet" aria-label={isKey ? 'Teacher answer key' : 'Student worksheet'}>
      {isKey && <div className="ws-key-banner" data-testid="ws-key-header" role="note">Teacher answer key<small>Not for students. {worksheet.title}</small></div>}
      <h1>{worksheet.title}</h1>
      {worksheet.instructions && <p className="ws-instructions">{worksheet.instructions}</p>}
      {worksheet.settings.includeName && !isKey && <div className="ws-meta" data-testid="ws-name-line">
        <div className="ws-field"><span>Name:</span><span className="ws-field-line" /></div>
        <div className="ws-field"><span>Date:</span><span className="ws-field-line" /></div>
      </div>}
      <p className="ws-total" data-testid="ws-total">{items.length} {items.length === 1 ? 'question' : 'questions'} · {pointsText(totalPoints(items))} in total</p>
      <ol className="ws-questions">{items.map(item => <Question key={item.number} item={item} mode={mode} showHints={worksheet.settings.showHints} urls={urls} />)}</ol>
    </article>
  </div>
}
