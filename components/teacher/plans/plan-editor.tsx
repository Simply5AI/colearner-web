'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, ExternalLink, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { TreeEditor } from '@/components/tree/TreeEditor'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { QuestionRenderer } from '@/components/questions/QuestionRenderer'
import { PlanStatusBadge } from '@/components/teacher/plans/plan-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import {
  archiveTeacherPlanClient,
  publishTeacherPlanClient,
  updateTeacherPlanClient,
} from '@/lib/api/teacher-plans-client'
import { mockMaterials, mockQuestions } from '@/lib/fixtures/teacher-ui'
import {
  addChildNode,
  collectTopicOptions,
  findTreeNode,
  removeTreeNode,
  updateTreeNode,
  wouldCreatePrerequisiteCycle,
} from '@/lib/teacher/plan-tree-utils'
import type { TeacherStudyPlan, TreeNode } from '@/lib/types/teacher'

interface PlanEditorProps {
  initialPlan: TeacherStudyPlan
}

function renameNode(nodes: TreeNode[], nodeId: string, title: string): TreeNode[] {
  return updateTreeNode(nodes, nodeId, (node) => ({ ...node, title }))
}

function updateNodeDescription(nodes: TreeNode[], nodeId: string, description: string): TreeNode[] {
  return updateTreeNode(nodes, nodeId, (node) => ({ ...node, description }))
}

function updateNodePrerequisites(
  nodes: TreeNode[],
  nodeId: string,
  prerequisiteTopicIds: string[],
): TreeNode[] {
  return updateTreeNode(nodes, nodeId, (node) => ({ ...node, prerequisiteTopicIds }))
}

function countTopicsWithoutQuestions(tree: TreeNode[]): number {
  const topicIds = collectTopicOptions(tree).map((topic) => topic.id)
  return topicIds.filter((topicId) => !mockQuestions.some((question) => question.topicId === topicId))
    .length
}

export function PlanEditor({ initialPlan }: PlanEditorProps) {
  const router = useRouter()
  const [plan, setPlan] = useState(initialPlan)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialPlan.tree[0]?.id ?? null)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)

  const selectedNode = useMemo(
    () => (selectedNodeId ? findTreeNode(plan.tree, selectedNodeId) : null),
    [plan.tree, selectedNodeId],
  )

  const topicOptions = useMemo(() => collectTopicOptions(plan.tree), [plan.tree])
  const topicsMissingQuestions = useMemo(() => countTopicsWithoutQuestions(plan.tree), [plan.tree])

  const markDirty = useCallback(() => setIsDirty(true), [])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  function updateTree(nextTree: TreeNode[]) {
    setPlan((current) => ({ ...current, tree: nextTree }))
    markDirty()
  }

  async function handleSave() {
    setIsSaving(true)
    try {
      const saved = await updateTeacherPlanClient(plan.id, {
        title: plan.title,
        description: plan.description,
        subjectTags: plan.subjectTags,
        tree: plan.tree,
      })
      setPlan(saved)
      setIsDirty(false)
      toast.success('Plan saved')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save plan')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    if (isDirty) {
      toast.error('Save your changes before publishing')
      return
    }

    setIsPublishing(true)
    try {
      const published = await publishTeacherPlanClient(plan.id)
      setPlan(published)
      setPublishOpen(false)
      toast.success('Plan published')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish plan')
    } finally {
      setIsPublishing(false)
    }
  }

  async function handleArchive() {
    setIsArchiving(true)
    try {
      const archived = await archiveTeacherPlanClient(plan.id)
      setPlan(archived)
      setArchiveOpen(false)
      toast.success('Plan archived')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to archive plan')
    } finally {
      setIsArchiving(false)
    }
  }

  function handleAddModule() {
    updateTree(addChildNode(plan.tree, null, 'New module'))
  }

  function handleAddChild() {
    if (!selectedNode) {
      toast.error('Select a node to add a child')
      return
    }
    if (selectedNode.kind === 'subtopic') {
      toast.error('Subtopics cannot have children')
      return
    }
    const childLabel = selectedNode.kind === 'module' ? 'New topic' : 'New subtopic'
    updateTree(addChildNode(plan.tree, selectedNode.id, childLabel))
  }

  function handleDeleteNode() {
    if (!selectedNodeId) return
    const nextTree = removeTreeNode(plan.tree, selectedNodeId)
    updateTree(nextTree)
    setSelectedNodeId(nextTree[0]?.id ?? null)
  }

  function handlePrerequisiteToggle(topicId: string, prerequisiteId: string, checked: boolean) {
    const current = selectedNode?.prerequisiteTopicIds ?? []
    const next = checked
      ? [...current, prerequisiteId]
      : current.filter((id) => id !== prerequisiteId)

    if (wouldCreatePrerequisiteCycle(plan.tree, topicId, next)) {
      toast.error('That prerequisite would create a cycle')
      return
    }

    updateTree(updateNodePrerequisites(plan.tree, topicId, next))
  }

  const topicMaterials = selectedNode
    ? mockMaterials.filter((material) => material.topicId === selectedNode.id || !material.topicId)
    : []
  const topicQuestions = selectedNode
    ? mockQuestions.filter((question) => question.topicId === selectedNode.id)
    : []

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{plan.title}</h2>
            <PlanStatusBadge status={plan.status} />
            {isDirty && (
              <span className="text-xs font-medium text-amber-600">Unsaved changes</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{plan.description || 'No description yet'}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void handleSave()} disabled={!isDirty || isSaving}>
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {plan.status === 'DRAFT' && (
            <Button onClick={() => setPublishOpen(true)}>Publish</Button>
          )}
          {plan.status !== 'ARCHIVED' && (
            <Button variant="outline" onClick={() => setArchiveOpen(true)}>
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Plan structure</CardTitle>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={handleAddModule}>
                  <Plus className="h-3.5 w-3.5" />
                  Module
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={handleAddChild}>
                  <Plus className="h-3.5 w-3.5" />
                  Child
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleDeleteNode}
                  disabled={!selectedNodeId}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <CardDescription>Drag to reorder modules, topics, and subtopics (up to 3 levels).</CardDescription>
          </CardHeader>
          <CardContent>
            {plan.tree.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Add your first module to start building the plan tree.
              </div>
            ) : (
              <TreeEditor
                nodes={plan.tree}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onReorder={updateTree}
                onRename={(nodeId, title) => updateTree(renameNode(plan.tree, nodeId, title))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedNode ? selectedNode.title : 'Select a node'}
            </CardTitle>
            <CardDescription>
              {selectedNode
                ? `Edit ${selectedNode.kind} details and manage linked content.`
                : 'Choose a module, topic, or subtopic from the tree.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="materials">Materials</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
                <TabsTrigger value="analytics">Analytics</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                {!selectedNode ? (
                  <p className="text-sm text-muted-foreground">Select a tree node to edit its details.</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="node-title">Title</Label>
                      <Input
                        id="node-title"
                        value={selectedNode.title}
                        onChange={(event) => {
                          const title = event.target.value
                          setPlan((current) => ({
                            ...current,
                            tree: renameNode(current.tree, selectedNode.id, title),
                          }))
                          markDirty()
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="node-description">Description</Label>
                      <Textarea
                        id="node-description"
                        value={selectedNode.description ?? ''}
                        rows={4}
                        onChange={(event) => {
                          const description = event.target.value
                          setPlan((current) => ({
                            ...current,
                            tree: updateNodeDescription(current.tree, selectedNode.id, description),
                          }))
                          markDirty()
                        }}
                      />
                    </div>

                    {(selectedNode.kind === 'topic' || selectedNode.kind === 'subtopic') && (
                      <div className="space-y-2">
                        <Label>Prerequisites</Label>
                        <p className="text-xs text-muted-foreground">
                          Students must complete prerequisite topics before this one. Cycles are blocked.
                        </p>
                        <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border p-3">
                          {topicOptions
                            .filter((option) => option.id !== selectedNode.id)
                            .map((option) => (
                              <label key={option.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={(selectedNode.prerequisiteTopicIds ?? []).includes(option.id)}
                                  onCheckedChange={(checked) =>
                                    handlePrerequisiteToggle(
                                      selectedNode.id,
                                      option.id,
                                      checked === true,
                                    )
                                  }
                                />
                                <span>{option.title}</span>
                                <span className="text-xs text-muted-foreground capitalize">
                                  {option.kind}
                                </span>
                              </label>
                            ))}
                          {topicOptions.filter((option) => option.id !== selectedNode.id).length === 0 && (
                            <p className="text-sm text-muted-foreground">Add more topics to set prerequisites.</p>
                          )}
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/teacher/plans/${plan.id}/topics/${selectedNode.id}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open topic view
                          </Link>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="materials" className="space-y-3 pt-4">
                {selectedNode && (selectedNode.kind === 'topic' || selectedNode.kind === 'subtopic') && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/teacher/plans/${plan.id}/topics/${selectedNode.id}/materials`}>
                      Manage materials
                    </Link>
                  </Button>
                )}
                <p className="text-sm text-muted-foreground">
                  Attach uploads and links to the selected topic.
                </p>
                {selectedNode && topicMaterials.length > 0 ? (
                  topicMaterials.slice(0, 2).map((material) => (
                    <div key={material.id} className="rounded-lg border p-3">
                      <MaterialViewer material={material} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No materials for this topic yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="questions" className="space-y-3 pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/plans/${plan.id}/questions`}>Open question bank</Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Author assessments per topic in the question bank.
                </p>
                {selectedNode && topicQuestions.length > 0 ? (
                  topicQuestions.slice(0, 2).map((question) => (
                    <div key={question.id} className="rounded-lg border p-3">
                      <QuestionRenderer question={question} mode="review" />
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No questions for this topic yet.
                  </div>
                )}
              </TabsContent>

              <TabsContent value="enrollments" className="space-y-3 pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/plans/${plan.id}/enrollments`}>Manage enrollments</Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  {plan.enrollmentCount} students enrolled. Create invite codes and view roster.
                </p>
              </TabsContent>

              <TabsContent value="analytics" className="space-y-3 pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/teacher/plans/${plan.id}/analytics`}>View plan analytics</Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Score distribution, engagement trends, and per-student progress.
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish study plan?</DialogTitle>
            <DialogDescription>
              Published plans become available for student enrollment. This action can be reversed by
              archiving the plan.
            </DialogDescription>
          </DialogHeader>
          {topicsMissingQuestions > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {topicsMissingQuestions} topic{topicsMissingQuestions === 1 ? '' : 's'}{' '}
              {topicsMissingQuestions === 1 ? 'has' : 'have'} no questions yet. Students may see empty
              assessments.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handlePublish()} disabled={isPublishing}>
              {isPublishing ? 'Publishing...' : 'Publish plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive study plan?</DialogTitle>
            <DialogDescription>
              Archived plans are hidden from new enrollments. Existing enrollments remain accessible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleArchive()} disabled={isArchiving}>
              {isArchiving ? 'Archiving...' : 'Archive plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}