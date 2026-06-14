'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EnrolledRecallActions } from '@/components/student/enrolled-recall-actions'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { TreeEditor } from '@/components/tree/TreeEditor'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { findTreeNode } from '@/lib/teacher/plan-tree-utils'
import type { StudentEnrolledPlan } from '@/lib/types/student-enrollment'

interface EnrolledPlanDetailProps {
  plan: StudentEnrolledPlan
}

export function EnrolledPlanDetail({ plan }: EnrolledPlanDetailProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    plan.tree[0]?.children?.[0]?.id ?? plan.tree[0]?.id ?? null,
  )

  const selectedTopic = useMemo(
    () => (selectedTopicId ? findTreeNode(plan.tree, selectedTopicId) : null),
    [plan.tree, selectedTopicId],
  )

  const materials = selectedTopicId ? plan.materialsByTopic[selectedTopicId] ?? [] : []
  const questionCount = selectedTopicId ? plan.questionCountsByTopic[selectedTopicId] ?? 0 : 0

  return (
    <div className="space-y-6">
      <Link
        href="/learn/enrolled"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to enrolled
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {plan.teacherName}
          </p>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          {plan.description && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{plan.description}</p>
          )}
        </div>
        <div className="min-w-[180px] rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Overall progress</p>
          <p className="text-2xl font-bold">{plan.progressPercent}%</p>
          <Progress value={plan.progressPercent} className="mt-2 h-1.5" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan outline</CardTitle>
            <CardDescription>Modules, topics, and subtopics for this plan.</CardDescription>
          </CardHeader>
          <CardContent>
            <TreeEditor
              nodes={plan.tree}
              readOnly
              selectedNodeId={selectedTopicId}
              onSelectNode={setSelectedTopicId}
              onReorder={() => undefined}
              onRename={() => undefined}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedTopic ? selectedTopic.title : 'Select a topic'}
            </CardTitle>
            <CardDescription>
              {selectedTopic
                ? `${materials.length} materials · ${questionCount} questions`
                : 'Choose a topic from the outline to view materials.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTopic ? (
              <>
                {materials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No materials for this topic yet.</p>
                ) : (
                  materials.map((material) => (
                    <div key={material.id} className="rounded-lg border p-3">
                      <MaterialViewer material={material} />
                    </div>
                  ))
                )}

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <EnrolledRecallActions
                    clonedPlanId={plan.id}
                    topicId={selectedTopic.id}
                    questionCount={questionCount}
                    size="sm"
                  />
                  <Link
                    href={`/learn/enrolled/${plan.id}/topic/${selectedTopic.id}`}
                    className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                  >
                    Open topic page
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a topic on the left to preview its learning materials.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}