import { describe, expect, it } from 'vitest'
import type { PlanTreeNode } from '@/lib/api/teaching/plans'
import { addNode, countTopics, findNode, firstTopic, moveBy, moveTo, nodesNeedingConfirmation, parentOf, removeNode, removeWithPrerequisites, renameNode } from '@/components/teacher/plans/tree-model'

const n = (id: string, kind: PlanTreeNode['kind'], children: PlanTreeNode[] = [], content = false): PlanTreeNode => ({
  id, kind, title: id, description: null, sortOrder: 0, dueAt: null, prerequisiteTopicIds: [],
  counts: { materials: content ? 2 : 0, publishedQuestions: 0, draftQuestions: 0, lesson: 'NONE' }, children,
})
const tree = (): PlanTreeNode[] => [
  { ...n('p1', 'module', [n('t1', 'topic', [n('s1', 'subtopic'), n('s2', 'subtopic')]), n('t2', 'topic', [], true), n('t3', 'topic')]), sortOrder: 0 },
  { ...n('p2', 'module', [n('t4', 'topic')]), sortOrder: 1 },
]
const ids = (nodes: PlanTreeNode[]) => nodes.map(node => node.id)

describe('plan tree model (F-T3-01)', () => {
  it('moves a node up and down among its siblings and renumbers sortOrder', () => {
    const down = moveBy(tree(), 't1', 1)!
    expect(ids(findNode(down, 'p1')!.children)).toEqual(['t2', 't1', 't3'])
    expect(findNode(down, 'p1')!.children.map(node => node.sortOrder)).toEqual([0, 1, 2])
    expect(ids(moveBy(down, 't1', -1)!.find(node => node.id === 'p1')!.children)).toEqual(['t1', 't2', 't3'])
  })
  it('does nothing at the ends and for an unknown id', () => {
    expect(moveBy(tree(), 't1', -1)).toBeNull(); expect(moveBy(tree(), 't3', 1)).toBeNull(); expect(moveBy(tree(), 'nope', 1)).toBeNull()
    expect(ids(moveBy(tree(), 'p2', -1)!)).toEqual(['p2', 'p1'])
  })
  it('drag and drop reorders only within one parent', () => {
    expect(ids(findNode(moveTo(tree(), 't3', 't1')!, 'p1')!.children)).toEqual(['t3', 't1', 't2'])
    expect(moveTo(tree(), 't1', 't4')).toBeNull()
    expect(moveTo(tree(), 's1', 't1')).toBeNull()
    expect(moveTo(tree(), 't1', 't1')).toBeNull()
    expect(ids(moveTo(tree(), 'p1', 'p2')!)).toEqual(['p2', 'p1'])
  })
  it('keeps the original tree untouched', () => { const original = tree(); moveBy(original, 't1', 1); expect(ids(original[0]!.children)).toEqual(['t1', 't2', 't3']) })
  it('adds a phase, a topic under a phase, a subtopic under a topic, and refuses a fourth level', () => {
    const phase = addNode(tree(), null, 'New phase')!; expect(findNode(phase.tree, phase.id)!.kind).toBe('module')
    const topic = addNode(tree(), 'p2', 'New topic')!; expect(findNode(topic.tree, topic.id)!.kind).toBe('topic')
    const sub = addNode(tree(), 't4', 'New sub')!; expect(findNode(sub.tree, sub.id)!.kind).toBe('subtopic')
    expect(addNode(tree(), 's1', 'too deep')).toBeNull(); expect(addNode(tree(), 'missing', 'x')).toBeNull()
  })
  it('renames and removes with renumbering', () => {
    expect(findNode(renameNode(tree(), 't1', 'Fractions'), 't1')!.title).toBe('Fractions')
    const removed = removeNode(tree(), 't2'); expect(ids(findNode(removed, 'p1')!.children)).toEqual(['t1', 't3']); expect(findNode(removed, 'p1')!.children.map(node => node.sortOrder)).toEqual([0, 1])
  })
  it('asks for confirmation for exactly the removed nodes that carry material, questions or a lesson', () => {
    expect(nodesNeedingConfirmation(findNode(tree(), 'p1'))).toEqual(['t2'])
    expect(nodesNeedingConfirmation(findNode(tree(), 't3'))).toEqual([])
    expect(nodesNeedingConfirmation(null)).toEqual([])
  })
  it('removing a topic also removes it from other topics prerequisites', () => {
    const base = tree(); findNode(base, 't3')!.prerequisiteTopicIds = ['t2', 't1']
    expect(findNode(removeWithPrerequisites(base, 't2'), 't3')!.prerequisiteTopicIds).toEqual(['t1'])
  })
  it('counts topics and finds the first topic and the parent', () => {
    expect(countTopics(tree())).toBe(6); expect(firstTopic(tree())!.id).toBe('t1')
    expect(parentOf(tree(), 's2')).toMatchObject({ index: 1, parent: { id: 't1' } })
  })
})
