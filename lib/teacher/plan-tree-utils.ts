import type { TreeNode, TreeNodeKind } from '@/lib/types/teacher'

export function countTopics(nodes: TreeNode[]): number {
  return nodes.reduce((total, node) => {
    const childCount = node.children ? countTopics(node.children) : 0
    if (node.kind === 'topic' || node.kind === 'subtopic') {
      return total + 1 + childCount
    }
    return total + childCount
  }, 0)
}

export function findTreeNode(nodes: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    if (node.children) {
      const match = findTreeNode(node.children, nodeId)
      if (match) return match
    }
  }
  return null
}

export function updateTreeNode(
  nodes: TreeNode[],
  nodeId: string,
  updater: (node: TreeNode) => TreeNode,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return updater(node)
    }
    if (node.children) {
      return { ...node, children: updateTreeNode(node.children, nodeId, updater) }
    }
    return node
  })
}

export function removeTreeNode(nodes: TreeNode[], nodeId: string): TreeNode[] {
  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) =>
      node.children ? { ...node, children: removeTreeNode(node.children, nodeId) } : node,
    )
}

function childKindFor(parentKind: TreeNodeKind): TreeNodeKind {
  if (parentKind === 'module') return 'topic'
  if (parentKind === 'topic') return 'subtopic'
  return 'subtopic'
}

export interface TopicOption {
  id: string
  title: string
  kind: TreeNodeKind
}

export function collectTopicOptions(nodes: TreeNode[], excludeId?: string): TopicOption[] {
  const options: TopicOption[] = []

  function walk(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if ((node.kind === 'topic' || node.kind === 'subtopic') && node.id !== excludeId) {
        options.push({ id: node.id, title: node.title, kind: node.kind })
      }
      if (node.children) walk(node.children)
    }
  }

  walk(nodes)
  return options
}

function buildPrerequisiteAdjacency(nodes: TreeNode[]): Map<string, string[]> {
  const adjacency = new Map<string, string[]>()

  function walk(nodeList: TreeNode[]) {
    for (const node of nodeList) {
      if (node.kind === 'topic' || node.kind === 'subtopic') {
        for (const prerequisiteId of node.prerequisiteTopicIds ?? []) {
          const edges = adjacency.get(prerequisiteId) ?? []
          edges.push(node.id)
          adjacency.set(prerequisiteId, edges)
        }
      }
      if (node.children) walk(node.children)
    }
  }

  walk(nodes)
  return adjacency
}

function canReach(adjacency: Map<string, string[]>, startId: string, targetId: string): boolean {
  const visited = new Set<string>()
  const stack = [startId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === targetId) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next)
    }
  }

  return false
}

export function wouldCreatePrerequisiteCycle(
  nodes: TreeNode[],
  topicId: string,
  prerequisiteTopicIds: string[],
): boolean {
  if (prerequisiteTopicIds.includes(topicId)) return true

  const adjacency = buildPrerequisiteAdjacency(nodes)

  for (const prerequisiteId of prerequisiteTopicIds) {
    if (canReach(adjacency, prerequisiteId, topicId)) return true
    const edges = adjacency.get(prerequisiteId) ?? []
    edges.push(topicId)
    adjacency.set(prerequisiteId, edges)
  }

  for (const prerequisiteId of prerequisiteTopicIds) {
    if (canReach(adjacency, topicId, prerequisiteId)) return true
  }

  return false
}

export function addChildNode(nodes: TreeNode[], parentId: string | null, title: string): TreeNode[] {
  const id = `node-${crypto.randomUUID().slice(0, 8)}`

  if (!parentId) {
    return [
      ...nodes,
      {
        id,
        kind: 'module',
        title,
        children: [],
      },
    ]
  }

  return updateTreeNode(nodes, parentId, (parent) => ({
    ...parent,
    children: [
      ...(parent.children ?? []),
      {
        id,
        kind: childKindFor(parent.kind),
        title,
        children: [],
      },
    ],
  }))
}