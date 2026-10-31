'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { AskCoEntry } from '@/components/co/co-launcher'
import { Card } from '@/components/design-system'
import { hasOriginal, lessonDisabledReason, materialApi, type MaterialDetail } from '@/lib/api/materials'
import { cn } from '@/lib/utils'
import { MaterialFrame, MaterialLoadState, MaterialProgress, materialKeys, useMaterialConfig } from './material-common'
import { PdfViewer } from './pdf-viewer'
import { AnalogyPanel, MaterialNotesPanel } from './reader-rail-panels'

type Tab = 'original' | 'text' | 'ideas'
type RailTab = 'ask' | 'analogy' | 'notes'

/** Only a stored PDF can be shown as the original; Word, PowerPoint, pasted text and links read as text. */
export const showsOriginal = (material: MaterialDetail) => material.sourceType === 'pdf' && hasOriginal(material)

export function MaterialReader({ id }: { id: string }) {
  const config = useMaterialConfig()
  const detail = useQuery({ queryKey: materialKeys.detail(config.actor, id), queryFn: () => materialApi.detail(id), enabled: !!config.data && !config.isError, retry: false, staleTime: 0, gcTime: 0 })
  const material = detail.data
  return <MaterialFrame title={material?.title ?? 'Read your material'} description="Read the original, the text Co extracted and the key ideas side by side. School and learner permissions are checked again when you open this page." config={config.data}>
    <MaterialLoadState loading={config.isPending || (!!config.data && detail.isPending)} error={config.error ?? detail.error} retry={() => { void config.refetch(); void detail.refetch() }} />
    {!config.error && !detail.error && material && config.data && <ReaderBody material={material} band={config.data.band} actor={config.actor} />}
  </MaterialFrame>
}

function ReaderBody({ material, band, actor }: { material: MaterialDetail; band: 'kids' | 'tweens' | 'teens'; actor: string }) {
  const original = showsOriginal(material)
  const tabs: { id: Tab; label: string }[] = [...(original ? [{ id: 'original' as const, label: 'Original' }] : []), { id: 'text', label: 'Text' }, { id: 'ideas', label: 'Key ideas' }]
  const [tab, setTab] = useState<Tab>(original ? 'original' : 'text')
  const [rail, setRail] = useState<RailTab>('ask')
  const ready = material.status === 'ready'
  const concepts = material.concepts.map(concept => ({ ref: concept.id, label: concept.label }))
  const summary = (material.analysis as { summary?: unknown } | null)?.summary
  return <>
    <MaterialProgress material={material} />
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-label="Material" className="min-w-0 space-y-4">
        <div role="tablist" aria-label="Material views" className="flex flex-wrap gap-2">
          {tabs.map(item => <button key={item.id} role="tab" type="button" id={`reader-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`reader-panel-${item.id}`} data-testid={`reader-tab-${item.id}`} onClick={() => setTab(item.id)} className={cn('ds-button', tab === item.id ? 'ds-button-primary' : 'ds-button-secondary')}>{item.label}</button>)}
        </div>
        <Card role="tabpanel" id={`reader-panel-${tab}`} aria-labelledby={`reader-tab-${tab}`} className="space-y-4 p-5">
          {tab === 'original' && original && <PdfViewer materialId={material.id} title={material.title} />}
          {tab === 'text' && (material.source
            ? <><p className="text-xs text-muted-foreground">Source version: {material.sourceVersionRef} · {material.source.anchors.length} source anchors</p><div className="max-w-prose whitespace-pre-wrap break-words leading-relaxed" data-testid="reader-text">{material.source.text}</div></>
            : <p>The source is not ready to read. Return to processing for its current status.</p>)}
          {tab === 'ideas' && <div className="space-y-3" data-testid="reader-ideas">
            {typeof summary === 'string' && summary && <p className="max-w-prose leading-relaxed">{summary}</p>}
            {material.concepts.length > 0 ? <ul className="flex flex-wrap gap-2">{material.concepts.map(concept => <li key={concept.id} className="ds-pill">{concept.label}</li>)}</ul> : <p className="text-sm text-muted-foreground">Key ideas appear here once Co has finished reading.</p>}
          </div>}
        </Card>
        {material.links.lesson ? <div className="flex flex-wrap items-center gap-3"><Link href={material.links.lesson} className="ds-button ds-button-primary">Start lesson</Link><p className="text-sm text-muted-foreground">Co makes a short five-step lesson from this material.</p></div> : <p className="text-sm text-muted-foreground" data-testid="lesson-unavailable">{lessonDisabledReason(material) ?? 'This reader does not create a lesson or practice activity. Those controls open only when their validated artifacts are available.'}</p>}
      </section>
      {ready && <aside aria-label="Study tools" className="min-w-0 space-y-3" data-testid="reader-rail">
        <div role="tablist" aria-label="Study tools" className="flex flex-wrap gap-2">
          {([['ask', 'Ask Co'], ['analogy', 'Analogy'], ['notes', 'My pages']] as const).map(([railId, label]) => <button key={railId} role="tab" type="button" aria-selected={rail === railId} data-testid={`rail-tab-${railId}`} onClick={() => setRail(railId)} className={cn('ds-button', rail === railId ? 'ds-button-primary' : 'ds-button-secondary')}>{label}</button>)}
        </div>
        <Card role="tabpanel" className="space-y-3 p-4">
          {rail === 'ask' && <AskCoEntry materialId={material.id} band={band} actor={actor} />}
          {rail === 'analogy' && <AnalogyPanel materialId={material.id} band={band} concepts={concepts} />}
          {rail === 'notes' && <MaterialNotesPanel materialId={material.id} band={band} />}
        </Card>
      </aside>}
    </div>
  </>
}
