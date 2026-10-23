'use client'

import { useMemo, useState } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PlanTreeNode } from '@/lib/api/teaching/plans'
import { cn } from '@/lib/utils'
import { InlineAlert } from './fields'
import { dateText } from './plan-format'
import { addNode, childKind, findNode, moveBy, moveTo, nodesNeedingConfirmation, parentOf, removeWithPrerequisites, renameNode, subtree } from './tree-model'

export interface TreeChange { tree: PlanTreeNode[]; confirmRemoveNodeIds?: string[]; selectId?: string; announce?: string }
interface PaneProps {
  tree: PlanTreeNode[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** False while the plan is published or archived: the tree is then read-only and `lockedReason` says why. */
  editable: boolean
  lockedReason: string | null
  busy: boolean
  onChange: (change: TreeChange) => void
}
const kindWord = { module: 'Phase', topic: 'Topic', subtopic: 'Subtopic' } as const
const lessonWord = { NONE: '', DRAFT: 'Lesson draft', PUBLISHED: 'Lesson published' } as const

function Row({ node, ...rest }: { node: PlanTreeNode } & Omit<PaneProps, 'tree'> & { depth: number; index: number; total: number; onMove: (id: string, delta: -1 | 1) => void }) {
  const { selectedId, onSelect, editable, busy, depth, onMove } = rest
  const sortable = useSortable({ id: node.id, disabled: !editable || busy })
  const selected = selectedId === node.id
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
  const label = `${kindWord[node.kind]}: ${node.title}`
  return <li ref={sortable.setNodeRef} style={style} data-testid="tree-node" data-node-id={node.id} data-kind={node.kind} className={cn('rounded-lg', sortable.isDragging && 'z-10 opacity-80 shadow-md')}>
    <div className={cn('flex items-center gap-1 rounded-lg border p-1', selected ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50')}>
      {editable ? <button type="button" ref={sortable.setActivatorNodeRef} {...sortable.attributes} {...sortable.listeners} aria-grabbed={sortable.isDragging} aria-label={`Reorder ${label}. Press space to pick up, arrow keys to move, space to drop.`} data-testid="tree-handle"
        className="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"><GripVertical aria-hidden="true" className="size-4" /></button>
        : <span className="flex size-8 shrink-0 items-center justify-center text-muted-foreground"><Lock aria-hidden="true" className="size-3.5" /><span className="sr-only">Locked</span></span>}
      <button type="button" onClick={() => onSelect(node.id)} aria-current={selected ? 'true' : undefined}
        className="min-w-0 flex-1 rounded px-1 py-1.5 text-start focus-visible:outline-2 focus-visible:outline-ring">
        <span className={cn('block break-words text-sm', node.kind === 'module' ? 'font-bold' : 'font-medium')}>{node.title || 'Untitled'}</span>
        <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
          <span>{kindWord[node.kind]}</span>
          {node.kind !== 'module' && node.counts.materials > 0 && <span>{node.counts.materials} {node.counts.materials === 1 ? 'material' : 'materials'}</span>}
          {node.kind !== 'module' && node.counts.lesson !== 'NONE' && <span>{lessonWord[node.counts.lesson]}</span>}
          {node.dueAt && <span>Due {dateText(node.dueAt)}</span>}
        </span>
      </button>
      {editable && <span className="flex shrink-0">
        <Button variant="ghost" size="icon" aria-label={`Move ${label} up`} onClick={() => onMove(node.id, -1)} disabled={busy || rest.index === 0}><ArrowUp aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label={`Move ${label} down`} onClick={() => onMove(node.id, 1)} disabled={busy || rest.index === rest.total - 1}><ArrowDown aria-hidden="true" /></Button>
      </span>}
    </div>
    {node.children.length > 0 && <Group nodes={node.children} {...rest} depth={depth + 1} />}
  </li>
}

function Group({ nodes, depth, ...rest }: { nodes: PlanTreeNode[]; depth: number } & Omit<PaneProps, 'tree'> & { onMove: (id: string, delta: -1 | 1) => void }) {
  return <SortableContext items={nodes.map(node => node.id)} strategy={verticalListSortingStrategy}>
    <ul className={cn('space-y-1', depth > 0 && 'ms-5 mt-1 border-s border-border ps-2')}>
      {nodes.map((node, index) => <Row key={node.id} node={node} {...rest} depth={depth} index={index} total={nodes.length} />)}
    </ul>
  </SortableContext>
}

/** T3 left pane: phases > topics (F-T3-01). Reorder by pointer drag, keyboard drag (space + arrows) or the move buttons. */
export function PlanTreePane(props: PaneProps) {
  const { tree, selectedId, editable, lockedReason, busy, onChange } = props
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const selected = selectedId ? findNode(tree, selectedId) : null
  const titles = useMemo(() => new Map(subtree({ id: '', kind: 'module', title: '', description: null, sortOrder: 0, dueAt: null, prerequisiteTopicIds: [], counts: { materials: 0, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' }, children: tree }).map(node => [node.id, node.title || 'Untitled'])), [tree])
  const describeMove = (id: string, next: PlanTreeNode[]) => {
    const place = parentOf(next, id)
    return `Moved ${titles.get(id) ?? 'item'} to position ${place ? place.index + 1 : '?'} of ${place ? place.siblings.length : '?'}.`
  }

  const move = (id: string, delta: -1 | 1) => {
    const next = moveBy(tree, id, delta)
    if (next) onChange({ tree: next, announce: describeMove(id, next) })
  }
  const onDragEnd = (event: DragEndEvent) => {
    if (!event.over || busy || !editable) return
    const next = moveTo(tree, String(event.active.id), String(event.over.id))
    if (next) onChange({ tree: next, announce: describeMove(String(event.active.id), next) })
  }
  const confirmNode = confirmRemove ? findNode(tree, confirmRemove) : null
  const removedCount = confirmNode ? subtree(confirmNode).length : 0
  const withContent = confirmNode ? nodesNeedingConfirmation(confirmNode) : []
  const childWord = selected ? childKind(selected.kind) : null

  return <section aria-label="Plan structure" data-testid="tree-pane" data-editable={editable} className="space-y-3">
    {!editable && lockedReason && <InlineAlert tone="locked" testId="tree-locked">{lockedReason}</InlineAlert>}
    {tree.length === 0 && <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="tree-empty">This plan has no phases yet.{editable ? ' Add a phase to begin.' : ''}</p>}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: 'To pick up this item press space. Use the arrow keys to move it among its siblings, then press space to drop it or escape to cancel.' },
        announcements: {
          onDragStart: ({ active }) => `Picked up ${titles.get(String(active.id)) ?? 'item'}.`,
          onDragOver: ({ active, over }) => over ? `${titles.get(String(active.id)) ?? 'Item'} is over ${titles.get(String(over.id)) ?? 'another item'}.` : undefined,
          onDragEnd: ({ active, over }) => over ? `Dropped ${titles.get(String(active.id)) ?? 'item'} at the place of ${titles.get(String(over.id)) ?? 'another item'}.` : `Dropped ${titles.get(String(active.id)) ?? 'item'} where it was.`,
          onDragCancel: ({ active }) => `Cancelled. ${titles.get(String(active.id)) ?? 'Item'} was not moved.`,
        },
      }}>
      {tree.length > 0 && <Group nodes={tree} {...props} depth={0} onMove={move} />}
    </DndContext>

    {editable && <div className="space-y-2 border-t border-border pt-3" data-testid="tree-actions">
      {selected && renaming === selected.id ? (
        <form className="flex gap-2" onSubmit={event => { event.preventDefault(); const title = draftTitle.trim(); if (!title) return; onChange({ tree: renameNode(tree, selected.id, title), announce: `Renamed to ${title}.` }); setRenaming(null) }}>
          <label className="sr-only" htmlFor="tree-rename">New name</label>
          <Input id="tree-rename" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} maxLength={500} autoFocus className="h-9" />
          <Button type="submit" size="lg" disabled={busy || !draftTitle.trim()}>Save</Button><Button type="button" variant="outline" size="lg" onClick={() => setRenaming(null)}>Cancel</Button>
        </form>
      ) : adding ? (
        <form className="flex gap-2" onSubmit={event => {
          event.preventDefault(); const title = newTitle.trim(); if (!title) return
          const added = addNode(tree, adding.parentId, title)
          if (added) { onChange({ tree: added.tree, selectId: added.id, announce: `Added ${title}.` }); setAdding(null); setNewTitle('') }
        }}>
          <label className="sr-only" htmlFor="tree-add">{adding.parentId ? 'New topic name' : 'New phase name'}</label>
          <Input id="tree-add" value={newTitle} onChange={e => setNewTitle(e.target.value)} maxLength={500} autoFocus placeholder={adding.parentId ? `${childWord === 'subtopic' ? 'Subtopic' : 'Topic'} name` : 'Phase name'} className="h-9" />
          <Button type="submit" size="lg" disabled={busy || !newTitle.trim()}>Add</Button><Button type="button" variant="outline" size="lg" onClick={() => { setAdding(null); setNewTitle('') }}>Cancel</Button>
        </form>
      ) : confirmNode ? (
        <div role="alertdialog" aria-label={`Remove ${confirmNode.title}`} data-testid="tree-confirm-remove" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p>Remove <strong>{confirmNode.title || 'this item'}</strong>{removedCount > 1 ? ` and ${removedCount - 1} ${removedCount === 2 ? 'item' : 'items'} inside it` : ''}?</p>
          {withContent.length > 0 && <p className="text-destructive">{withContent.length === 1 ? 'One item' : `${withContent.length} items`} here {withContent.length === 1 ? 'has' : 'have'} materials, questions or a lesson. They will be removed with it.</p>}
          <div className="flex gap-2"><Button variant="destructive" size="lg" disabled={busy} onClick={() => { onChange({ tree: removeWithPrerequisites(tree, confirmNode.id), confirmRemoveNodeIds: withContent, announce: `Removed ${confirmNode.title}.` }); setConfirmRemove(null) }}>Remove</Button><Button variant="outline" size="lg" onClick={() => setConfirmRemove(null)}>Keep it</Button></div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={() => { setAdding({ parentId: null }); setNewTitle('') }} disabled={busy}><Plus aria-hidden="true" />Add phase</Button>
          {selected && childWord && <Button variant="outline" size="lg" onClick={() => { setAdding({ parentId: selected.id }); setNewTitle('') }} disabled={busy}><Plus aria-hidden="true" />Add {childWord}</Button>}
          {selected && <Button variant="outline" size="lg" onClick={() => { setRenaming(selected.id); setDraftTitle(selected.title) }} disabled={busy}><Pencil aria-hidden="true" />Rename</Button>}
          {selected && <Button variant="destructive" size="lg" onClick={() => setConfirmRemove(selected.id)} disabled={busy}><Trash2 aria-hidden="true" />Remove</Button>}
        </div>
      )}
    </div>}
  </section>
}
