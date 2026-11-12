'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, Camera, FileText, Globe, Link2, Mic, Upload, Youtube } from 'lucide-react'
import { AgeBandScope, Button, Card, CoCharacter, ErrorState, LoadingState, Select } from '@/components/design-system'
import { materialApi, pendingMaterial, type Material, type MaterialConfig, type SourceType } from '@/lib/api/materials'
import type { ReactNode } from 'react'
import { useMaterialIdentity } from './material-identity'
import { sourceLabel } from '@/lib/materials/source-link'
import { conceptLessonHref } from '@/lib/materials/concept-lesson'
import { MaterialPartialNotice } from './material-partial'
import { needsLinkHelp } from '@/lib/api/learn-link'
import { SeeWhatsNeededLink } from '@/components/learn/see-whats-needed'

/** "Learn this": starts a lesson about ONE key idea (the main "Start lesson" stays for the whole material). Hidden when lessons are off. */
export function LearnThis({ lessonRoute, conceptId, label }: { lessonRoute: string | null; conceptId: string; label: string }) {
  const href = conceptLessonHref(lessonRoute, conceptId)
  return href ? <Link href={href} aria-label={`Learn this: ${label}`} data-testid="learn-this" className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring">Learn this</Link> : null
}
export const sourceLabels: Record<SourceType, string> = { text: 'Pasted text', pdf: 'PDF', docx: 'Word', pptx: 'PowerPoint', image: 'Photo', audio: 'Audio', youtube: 'YouTube', web: 'Website', paper: 'Paper' }
export const sourceIcons = { text: FileText, pdf: FileText, docx: FileText, pptx: FileText, image: Camera, audio: Mic, youtube: Link2, web: Link2, paper: BookOpen }
/** Where a link import came from: icon, hostname and an "Open original" link. Renders nothing for uploads and pasted text. */
export function MaterialSourceLine({ material }: { material: Pick<Material, 'sourceType' | 'sourceUrl'> }) {
  const label = sourceLabel(material.sourceUrl)
  if (!material.sourceUrl || !label) return null
  const Icon = material.sourceType === 'youtube' ? Youtube : material.sourceType === 'paper' ? BookOpen : Globe
  return <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" data-testid="material-source"><Icon size={16} aria-hidden="true" className="shrink-0" /><span className="min-w-0 break-all">{label}</span><a href={material.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-2">Open original ↗<span className="sr-only"> (opens in a new tab)</span></a></p>
}
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
  return <Card className="space-y-4 p-5" aria-live="polite" data-testid="material-progress" data-status={material.status}><div className="flex flex-wrap items-center gap-4"><CoCharacter band="teens" state={material.status === 'ready' ? 'celebrating' : material.status === 'failed' || material.status === 'cancelled' ? 'encouraging' : 'reading'} size={72} decorative /><div className="min-w-0 flex-1 space-y-1"><h2 className="break-words text-xl font-bold">{material.title}</h2><MaterialPartialNotice material={material} />{material.status === 'ready' && <p className="font-semibold text-primary">Your material is ready!{material.concepts.length > 0 ? ` Co found ${material.concepts.length} key ideas.` : ''}</p>}{pendingMaterial(material) && <p className="font-semibold text-primary">Co is reading it now. This usually takes under a minute.</p>}</div><span className="rounded-full bg-muted px-3 py-1 text-sm">{materialStatusLabels[material.status]}</span></div><ol className="flex flex-wrap gap-4">{steps.map((step, index) => <li key={step.id} aria-current={step.id === material.stage ? 'step' : undefined} className={`flex items-center gap-2 text-sm ${index <= current ? 'font-semibold text-primary' : 'text-muted-foreground'}`}><span className="flex size-7 items-center justify-center rounded-full border border-current">{index + 1}</span>{step.label}</li>)}</ol><progress aria-label="Material processing progress" max={100} value={material.progress} className="h-3 w-full appearance-none overflow-hidden rounded-full border border-border bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary" /><p className="text-sm text-muted-foreground">{pendingMaterial(material) ? 'You can leave this page and return from your library. Processing is saved on the server.' : material.status === 'ready' ? 'The source and key ideas are ready. Lessons and practice become available after their own validated learning steps.' : material.error?.message ?? 'This import was cancelled.'}</p>{material.concepts.length > 0 && <ul aria-label="Key ideas" className="flex flex-wrap gap-2">{material.concepts.map(concept => <li key={concept.id} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm">{concept.label}<LearnThis lessonRoute={material.links.lesson} conceptId={concept.id} label={concept.label} /></li>)}</ul>}<p className="text-xs text-muted-foreground">{material.subjectName}{material.planTitle ? ` · ${material.planTitle}` : ''} · Updated {new Date(material.updatedAt).toLocaleString()}</p><MaterialSourceLine material={material} /></Card>
}
