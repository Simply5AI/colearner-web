'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Camera, FileText, Link2, Mic, Upload } from 'lucide-react'
import { AgeBandScope, Button, Card, ErrorState, LoadingState, Select } from '@/components/design-system'
import { materialApi, pendingMaterial, type Material, type MaterialConfig, type SourceType } from '@/lib/api/materials'
import type { ReactNode } from 'react'
import { useMaterialIdentity } from './material-identity'
import { needsLinkHelp } from '@/lib/api/learn-link'
import { SeeWhatsNeededLink } from '@/components/learn/see-whats-needed'

export const sourceLabels: Record<SourceType, string> = { text: 'Pasted text', pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', image: 'Photo', audio: 'Audio', youtube: 'YouTube', web: 'Website', paper: 'Paper' }
export const sourceIcons = { text: FileText, pdf: FileText, docx: FileText, pptx: FileText, image: Camera, audio: Mic, youtube: Link2, web: Link2, paper: BookOpen }
export const materialStatusLabels = { queued: 'Waiting to read', processing: 'Reading material', ready: 'Analysis ready', failed: 'Could not finish', cancelled: 'Cancelled' }
export const materialKeys = { root: ['materials'] as const, config: (actor: string) => ['materials', actor, 'config'] as const, list: (actor: string, filters: unknown) => ['materials', actor, 'list', filters] as const, detail: (actor: string, id: string) => ['materials', actor, 'detail', id] as const }
export function useMaterialConfig() {
  const actor = useMaterialIdentity()
  const query = useQuery({ queryKey: materialKeys.config(actor), queryFn: materialApi.config, enabled: !!actor, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' })
  return { ...query, actor }
}
export function MaterialFrame({ title, description, config, children }: { title: string; description: string; config?: MaterialConfig; children: ReactNode }) {
  return <AgeBandScope band={config?.band ?? 'teens'} className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-7">
    <nav aria-label="Material tools" className="flex flex-wrap gap-3 text-sm font-semibold"><Link className="ds-button ds-button-ghost" href="/learn/library"><BookOpen size={18} aria-hidden="true" />Library</Link><Link className="ds-button ds-button-ghost" href="/learn/import"><Upload size={18} aria-hidden="true" />Import</Link><Link className="ds-button ds-button-ghost" href="/learn/snap"><Camera size={18} aria-hidden="true" />Snap a page</Link></nav>
    <header className="space-y-2"><p className="text-xs font-bold uppercase tracking-widest text-primary">Your learning material</p><h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1><p className="max-w-2xl text-muted-foreground">{description}</p></header>
    {children}
  </AgeBandScope>
}
export function MaterialLoadState({ loading, error, retry }: { loading?: boolean; error?: Error | null; retry: () => void }) {
  if (error) return <ErrorState title="Material services unavailable" description={error.message} action={<div className="flex flex-wrap justify-center gap-3">{needsLinkHelp(error) && <SeeWhatsNeededLink />}<Button onClick={retry} variant="secondary">Try again</Button><Link href="/learner" className="ds-button ds-button-secondary">Check learner access</Link></div>} />
  return loading ? <LoadingState label="Checking school permissions and material settings…" /> : null
}
export function MaterialSelectors({ config, subjectId, planId, setSubjectId, setPlanId }: { config: MaterialConfig; subjectId: string; planId: string; setSubjectId: (value: string) => void; setPlanId: (value: string) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2"><Select label="Add to subject" value={subjectId} onChange={event => setSubjectId(event.target.value)} required><option value="">Choose an allowed subject</option>{config.subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</Select><Select label="Add to plan (optional)" value={planId} onChange={event => setPlanId(event.target.value)}><option value="">Keep in my library</option>{config.plans.map(plan => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</Select></div>
}
export function MaterialProgress({ material }: { material: Material }) {
  const steps = [{ id: 'reading', label: 'Reading your source' }, { id: 'concepts', label: 'Finding key ideas' }, { id: 'ready', label: 'Analysis ready' }]
  const current = steps.findIndex(step => step.id === material.stage)
  return <Card className="space-y-4 p-5" aria-live="polite"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{material.title}</h2><span className="rounded-full bg-muted px-3 py-1 text-sm">{materialStatusLabels[material.status]}</span></div><ol className="flex flex-wrap gap-4">{steps.map((step, index) => <li key={step.id} aria-current={step.id === material.stage ? 'step' : undefined} className={`flex items-center gap-2 text-sm ${index <= current ? 'font-semibold text-primary' : 'text-muted-foreground'}`}><span className="flex size-7 items-center justify-center rounded-full border border-current">{index + 1}</span>{step.label}</li>)}</ol><progress aria-label="Material processing progress" max={100} value={material.progress} className="h-3 w-full accent-primary" /><p className="text-sm text-muted-foreground">{pendingMaterial(material) ? 'You can leave this page and return from your library. Processing is saved on the server.' : material.status === 'ready' ? 'The source and key ideas are ready. Lessons and practice become available after their own validated learning steps.' : material.error?.message ?? 'This import was cancelled.'}</p>{material.concepts.length > 0 && <ul aria-label="Key ideas" className="flex flex-wrap gap-2">{material.concepts.map(concept => <li key={concept.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{concept.label}</li>)}</ul>}<p className="text-xs text-muted-foreground">{material.subjectName}{material.planTitle ? ` · ${material.planTitle}` : ''} · Updated {new Date(material.updatedAt).toLocaleString()}</p></Card>
}
