'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Download, FileText, Film, Image as ImageIcon, Link2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { materialTypeLabel, type MaterialType, type TeachingMaterial } from '@/lib/api/teaching/materials'
import { teachingErrorInfo, teachingErrorText, type PlanStatus } from '@/lib/api/teaching/plans'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { useTeachingApis } from '@/components/teacher/plans/use-teaching-apis'
import { AddMaterialForm } from './add-material-form'

const iconFor = (type: MaterialType) => type === 'IMAGE' ? ImageIcon : type === 'VIDEO_LINK' || type === 'VIDEO_UPLOAD' ? Film : type === 'EXTERNAL_LINK' ? Link2 : FileText
const sizeText = (bytes: number | null) => bytes === null ? '' : bytes >= 1048576 ? ` · ${(bytes / 1048576).toFixed(1)} MB` : ` · ${Math.max(1, Math.round(bytes / 1024))} KB`

export interface TopicMaterialsPanelProps {
  planId: string
  topicId: string
  planStatus: PlanStatus
  materials: TeachingMaterial[]
  photo: { available: boolean; reason: string | null }
  /** Called after any change so the workspace and tree counts reload. */
  onChanged: () => void
}

/** Materials of one topic (F-T3-02). Draft materials are invisible to learners; a published plan adds new material as a draft that is published on its own. */
export function TopicMaterialsPanel({ planId, topicId, planStatus, materials, photo, onChanged }: TopicMaterialsPanelProps) {
  const apis = useTeachingApis()
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null)
  const archived = planStatus === 'ARCHIVED'
  const sorted = [...materials].sort((a, b) => a.sortOrder - b.sortOrder)

  async function run<T>(id: string, action: () => Promise<T>): Promise<T | undefined> {
    setBusy(id); setFailure(null)
    try { const result = await action(); onChanged(); return result }
    catch (error) {
      const info = teachingErrorInfo(error)
      setFailure(info.code === 'MATERIAL_IN_USE' || (info.status === 409 && removing === id) ? 'This material is the source of a lesson draft, so it cannot be deleted yet. Remove it from the lesson or discard the draft first.' : teachingErrorText(error))
      return undefined
    } finally { setBusy(null) }
  }
  const move = (index: number, delta: -1 | 1) => {
    const next = [...sorted]; const target = index + delta
    if (target < 0 || target >= next.length) return
    const [moved] = next.splice(index, 1); next.splice(target, 0, moved!)
    void run('reorder', () => apis.materials.reorder(planId, topicId, next.map((item, order) => ({ id: item.id, sortOrder: order }))))
  }
  async function open(material: TeachingMaterial) {
    if (material.externalUrl) { window.open(material.externalUrl, '_blank', 'noopener,noreferrer'); return }
    setBusy(material.id); setFailure(null)
    try { const target = await apis.materials.downloadUrl(planId, material.id); window.open(target.url, '_blank', 'noopener,noreferrer') }
    catch (error) { setFailure(teachingErrorText(error)) } finally { setBusy(null) }
  }

  return <section aria-label="Materials" className="space-y-3" data-testid="materials-panel">
    <h3 className="text-base font-bold">Materials</h3>
    {planStatus === 'PUBLISHED' && <InlineAlert tone="info">This plan is published. New material starts as a draft; students see it once you publish that item.</InlineAlert>}
    {planStatus === 'DRAFT' && <p className="text-xs text-muted-foreground">Students see material once the plan is published and assigned to their class.</p>}
    {failure && <InlineAlert testId="materials-failure">{failure}</InlineAlert>}
    {sorted.length === 0
      ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="materials-empty">No material in this topic yet. Upload a file, add a link or take a photo.</p>
      : <ul className="space-y-2" aria-label="Materials in this topic">{sorted.map((material, index) => {
        const Icon = iconFor(material.type)
        const editing = renaming?.id === material.id
        return <li key={material.id} className="rounded-lg border border-border p-3" data-testid="material-row" data-status={material.status}>
          <div className="flex flex-wrap items-start gap-3">
            <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              {editing ? <form className="flex gap-2" onSubmit={e => { e.preventDefault(); const title = renaming.title.trim(); if (title) void run(material.id, () => apis.materials.update(planId, material.id, { title })).then(done => { if (done) setRenaming(null) }) }}>
                <label className="sr-only" htmlFor={`rename-${material.id}`}>Material title</label>
                <Input id={`rename-${material.id}`} value={renaming.title} onChange={e => setRenaming({ id: material.id, title: e.target.value })} className="h-9" maxLength={200} autoFocus />
                <Button type="submit" size="lg" disabled={busy !== null}>Save</Button><Button type="button" variant="outline" size="lg" onClick={() => setRenaming(null)}>Cancel</Button>
              </form> : <p className="break-words font-semibold">{material.title}</p>}
              <p className="text-xs text-muted-foreground">{materialTypeLabel[material.type]}{sizeText(material.sizeBytes)} · <span data-testid="material-status">{material.status === 'DRAFT' ? 'Draft: students cannot see it yet' : 'Published'}</span></p>
              {material.description && <p className="mt-1 break-words text-sm">{material.description}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="ghost" size="icon" aria-label={`Move ${material.title} up`} disabled={busy !== null || index === 0 || archived} onClick={() => move(index, -1)}><ArrowUp aria-hidden="true" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Move ${material.title} down`} disabled={busy !== null || index === sorted.length - 1 || archived} onClick={() => move(index, 1)}><ArrowDown aria-hidden="true" /></Button>
              <Button variant="outline" size="lg" disabled={busy !== null} onClick={() => void open(material)}><Download aria-hidden="true" />{material.externalUrl ? 'Open' : 'View'}</Button>
              {!archived && !editing && <Button variant="outline" size="lg" disabled={busy !== null} onClick={() => setRenaming({ id: material.id, title: material.title })}>Rename</Button>}
              {material.status === 'DRAFT' && !archived && <Button size="lg" disabled={busy !== null} onClick={() => void run(material.id, () => apis.materials.publish(planId, material.id))} data-testid="publish-material">Publish material</Button>}
              {!archived && <Button variant="destructive" size="lg" disabled={busy !== null} onClick={() => setRemoving(material.id)} aria-label={`Delete ${material.title}`}><Trash2 aria-hidden="true" />Delete</Button>}
            </div>
          </div>
          {!archived && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={material.downloadable} disabled={busy !== null} onChange={e => void run(material.id, () => apis.materials.update(planId, material.id, { downloadable: e.target.checked }))} />Students may download this file</label>}
          {removing === material.id && <div role="alertdialog" aria-label={`Delete ${material.title}`} className="mt-2 space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" data-testid="material-confirm-delete">
            <p>Delete <strong>{material.title}</strong>? Students will no longer see it. This cannot be undone.</p>
            <div className="flex gap-2"><Button variant="destructive" size="lg" disabled={busy !== null} onClick={() => void run(material.id, async () => { await apis.materials.remove(planId, material.id); return true }).then(done => { if (done) setRemoving(null) })}>Delete</Button><Button variant="outline" size="lg" onClick={() => setRemoving(null)}>Keep it</Button></div>
          </div>}
        </li>
      })}</ul>}
    {!archived && <AddMaterialForm planId={planId} topicId={topicId} photo={photo} onAdded={onChanged} />}
  </section>
}
