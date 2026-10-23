import type { PlanTreeNode } from '@/lib/api/teaching/plans'

/*
 * Pure plan-tree operations for T3. The tree is phases (kind `module`) > topics > subtopics (at most three levels).
 * Reordering is within one parent; every operation returns a NEW tree with `sortOrder` renumbered, or null when it cannot apply.
 */
export const noCounts = { materials: 0, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' } as const satisfies PlanTreeNode['counts']

export function findNode(nodes: PlanTreeNode[], id: string): PlanTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}
export function parentOf(nodes: PlanTreeNode[], id: string, parent: PlanTreeNode | null = null): { parent: PlanTreeNode | null; siblings: PlanTreeNode[]; index: number } | null {
  const index = nodes.findIndex(node => node.id === id)
  if (index >= 0) return { parent, siblings: nodes, index }
  for (const node of nodes) {
    const found = parentOf(node.children, id, node)
    if (found) return found
  }
  return null
}
export const renumber = (nodes: PlanTreeNode[]): PlanTreeNode[] => nodes.map((node, index) => ({ ...node, sortOrder: index, children: renumber(node.children) }))
const mapNode = (nodes: PlanTreeNode[], id: string, change: (node: PlanTreeNode) => PlanTreeNode): PlanTreeNode[] =>
  nodes.map(node => node.id === id ? change(node) : { ...node, children: mapNode(node.children, id, change) })
function replaceSiblings(nodes: PlanTreeNode[], parentId: string | null, siblings: PlanTreeNode[]): PlanTreeNode[] {
  if (parentId === null) return siblings
  return mapNode(nodes, parentId, node => ({ ...node, children: siblings }))
}

export function moveBy(tree: PlanTreeNode[], id: string, delta: -1 | 1): PlanTreeNode[] | null {
  const place = parentOf(tree, id)
  if (!place) return null
  const target = place.index + delta
  if (target < 0 || target >= place.siblings.length) return null
  const siblings = [...place.siblings]
  const [moved] = siblings.splice(place.index, 1)
  siblings.splice(target, 0, moved!)
  return renumber(replaceSiblings(tree, place.parent?.id ?? null, siblings))
}
/** Drag and drop: move `activeId` to the position of `overId`. Only within the same parent (a phase cannot be dropped into another phase). */
export function moveTo(tree: PlanTreeNode[], activeId: string, overId: string): PlanTreeNode[] | null {
  if (activeId === overId) return null
  const from = parentOf(tree, activeId)
  const to = parentOf(tree, overId)
  if (!from || !to || (from.parent?.id ?? null) !== (to.parent?.id ?? null)) return null
  const siblings = [...from.siblings]
  const [moved] = siblings.splice(from.index, 1)
  siblings.splice(to.index, 0, moved!)
  return renumber(replaceSiblings(tree, from.parent?.id ?? null, siblings))
}

export const childKind = (kind: PlanTreeNode['kind']): PlanTreeNode['kind'] | null => kind === 'module' ? 'topic' : kind === 'topic' ? 'subtopic' : null
export const newNodeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `node-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)

export function addNode(tree: PlanTreeNode[], parentId: string | null, title: string): { tree: PlanTreeNode[]; id: string } | null {
  const parent = parentId === null ? null : findNode(tree, parentId)
  if (parentId !== null && !parent) return null
  const kind = parent === null ? 'module' : childKind(parent.kind)
  if (!kind) return null
  const id = newNodeId()
  const node: PlanTreeNode = { id, kind, title, description: null, sortOrder: 0, dueAt: null, prerequisiteTopicIds: [], counts: { ...noCounts }, children: [] }
  if (parent === null) return { tree: renumber([...tree, node]), id }
  return { tree: renumber(mapNode(tree, parent.id, entry => ({ ...entry, children: [...entry.children, node] }))), id }
}
export const renameNode = (tree: PlanTreeNode[], id: string, title: string) => mapNode(tree, id, node => ({ ...node, title }))
export function removeNode(tree: PlanTreeNode[], id: string): PlanTreeNode[] {
  return renumber(tree.filter(node => node.id !== id).map(node => ({ ...node, children: removeNode(node.children, id) })))
}
/** Dropping a node also drops anything that listed it as a prerequisite. */
export function removeWithPrerequisites(tree: PlanTreeNode[], id: string): PlanTreeNode[] {
  const gone = new Set(subtree(findNode(tree, id)).map(node => node.id))
  const clean = (nodes: PlanTreeNode[]): PlanTreeNode[] => nodes.filter(node => !gone.has(node.id)).map(node => ({ ...node, prerequisiteTopicIds: node.prerequisiteTopicIds.filter(entry => !gone.has(entry)), children: clean(node.children) }))
  return renumber(clean(tree))
}
export function subtree(node: PlanTreeNode | null): PlanTreeNode[] {
  return node ? [node, ...node.children.flatMap(child => subtree(child))] : []
}
export const hasContent = (node: PlanTreeNode) => node.counts.materials > 0 || node.counts.publishedQuestions > 0 || node.counts.draftQuestions > 0 || node.counts.lesson !== 'NONE'
/** The ids the server wants in `confirmRemoveNodeIds`: every removed node that carries materials, questions or a lesson. */
export const nodesNeedingConfirmation = (node: PlanTreeNode | null) => subtree(node).filter(hasContent).map(entry => entry.id)
export const countTopics = (tree: PlanTreeNode[]): number => tree.reduce((total, node) => total + (node.kind === 'module' ? 0 : 1) + countTopics(node.children), 0)
export const isTopicNode = (node: PlanTreeNode) => node.kind !== 'module'
export function firstTopic(tree: PlanTreeNode[]): PlanTreeNode | null {
  for (const node of tree) {
    if (node.kind !== 'module') return node
    const inner = firstTopic(node.children)
    if (inner) return inner
  }
  return null
}
export function flatten(tree: PlanTreeNode[]): PlanTreeNode[] {
  return tree.flatMap(node => [node, ...flatten(node.children)])
}
