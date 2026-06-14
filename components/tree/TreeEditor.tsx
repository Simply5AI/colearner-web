'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronRight, GripVertical, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { TreeNode, TreeNodeKind } from '@/lib/types/teacher'

const MAX_DEPTH = 3

interface FlatTreeNode extends TreeNode {
  depth: number
  parentId: string | null
}

interface TreeEditorProps {
  nodes: TreeNode[]
  onReorder: (nodes: TreeNode[]) => void
  onRename: (nodeId: string, title: string) => void
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
  renderNode?: (node: TreeNode) => React.ReactNode
  readOnly?: boolean
}

function flattenTree(nodes: TreeNode[], depth = 0, parentId: string | null = null): FlatTreeNode[] {
  return nodes.flatMap((node) => {
    const current: FlatTreeNode = { ...node, depth, parentId }
    const children = node.children ? flattenTree(node.children, depth + 1, node.id) : []
    return [current, ...children]
  })
}

function rebuildTree(flatNodes: FlatTreeNode[]): TreeNode[] {
  const byParent = new Map<string | null, FlatTreeNode[]>()
  for (const node of flatNodes) {
    const bucket = byParent.get(node.parentId) ?? []
    bucket.push(node)
    byParent.set(node.parentId, bucket)
  }

  function build(parentId: string | null): TreeNode[] {
    return (byParent.get(parentId) ?? []).map(({ depth: _depth, parentId: _parentId, children: _children, ...node }) => ({
      ...node,
      children: build(node.id),
    }))
  }

  return build(null)
}

function SortableTreeRow({
  node,
  expanded,
  onToggle,
  onRename,
  renderNode,
  editingId,
  setEditingId,
  draftTitle,
  setDraftTitle,
  selectedNodeId,
  onSelectNode,
  readOnly = false,
}: {
  node: FlatTreeNode
  expanded: boolean
  onToggle: () => void
  onRename: (nodeId: string, title: string) => void
  renderNode?: (node: TreeNode) => React.ReactNode
  editingId: string | null
  setEditingId: (id: string | null) => void
  draftTitle: string
  setDraftTitle: (value: string) => void
  selectedNodeId?: string | null
  onSelectNode?: (nodeId: string) => void
  readOnly?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: readOnly,
  })

  const style = readOnly
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      }

  const hasChildren = (node.children?.length ?? 0) > 0
  const kindLabel: Record<TreeNodeKind, string> = {
    module: 'Module',
    topic: 'Topic',
    subtopic: 'Subtopic',
  }

  return (
    <div
      ref={setNodeRef}
      role={onSelectNode ? 'button' : undefined}
      tabIndex={onSelectNode ? 0 : undefined}
      onClick={() => onSelectNode?.(node.id)}
      onKeyDown={(event) => {
        if (onSelectNode && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onSelectNode(node.id)
        }
      }}
      className={cn(
        'flex items-center gap-2 rounded-lg border bg-background px-2 py-2',
        isDragging && 'opacity-70 shadow-md',
        selectedNodeId === node.id && 'border-primary/50 bg-primary/5',
        onSelectNode && 'cursor-pointer',
      )}
      style={{
        ...style,
        marginLeft: `${node.depth * 16}px`,
      }}
    >
      {!readOnly && (
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      <button
        type="button"
        className="text-muted-foreground"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {hasChildren ? (
          expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        ) : (
          <span className="inline-block w-4" />
        )}
      </button>

      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {kindLabel[node.kind]}
      </span>

      {!readOnly && editingId === node.id ? (
        <Input
          autoFocus
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={() => {
            if (draftTitle.trim()) onRename(node.id, draftTitle.trim())
            setEditingId(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (draftTitle.trim()) onRename(node.id, draftTitle.trim())
              setEditingId(null)
            }
            if (event.key === 'Escape') setEditingId(null)
          }}
          className="h-8 flex-1"
        />
      ) : (
        <div className="flex flex-1 items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{node.title}</p>
            {renderNode?.(node)}
          </div>
          {!readOnly && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setEditingId(node.id)
                setDraftTitle(node.title)
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function TreeEditor({
  nodes,
  onReorder,
  onRename,
  selectedNodeId,
  onSelectNode,
  renderNode,
  readOnly = false,
}: TreeEditorProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const flatNodes = useMemo(() => flattenTree(nodes), [nodes])
  const visibleNodes = useMemo(
    () =>
      flatNodes.filter((node) => {
        if (node.depth === 0) return true
        let parentId = node.parentId
        while (parentId) {
          if (expanded[parentId] === false) return false
          parentId = flatNodes.find((candidate) => candidate.id === parentId)?.parentId ?? null
        }
        return true
      }),
    [flatNodes, expanded],
  )

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    if (readOnly) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = flatNodes.findIndex((node) => node.id === active.id)
    const newIndex = flatNodes.findIndex((node) => node.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(flatNodes, oldIndex, newIndex).map((node) => {
      if (node.depth >= MAX_DEPTH - 1) {
        return { ...node, children: [] }
      }
      return node
    })

    onReorder(rebuildTree(reordered))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleNodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {visibleNodes.map((node) => (
            <SortableTreeRow
              key={node.id}
              node={node}
              expanded={expanded[node.id] ?? true}
              onToggle={() =>
                setExpanded((current) => ({ ...current, [node.id]: !(current[node.id] ?? true) }))
              }
              onRename={onRename}
              renderNode={renderNode}
              editingId={editingId}
              setEditingId={setEditingId}
              draftTitle={draftTitle}
              setDraftTitle={setDraftTitle}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              readOnly={readOnly}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}