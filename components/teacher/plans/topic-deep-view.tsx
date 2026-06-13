'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { QuestionRenderer } from '@/components/questions/QuestionRenderer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { mockMaterials, mockQuestions } from '@/lib/fixtures/teacher-ui'
import { findTreeNode } from '@/lib/teacher/plan-tree-utils'
import type { TeacherStudyPlan } from '@/lib/types/teacher'

interface TopicDeepViewProps {
  plan: TeacherStudyPlan
  topicId: string
}

export function TopicDeepView({ plan, topicId }: TopicDeepViewProps) {
  const topic = findTreeNode(plan.tree, topicId)
  const materials = mockMaterials.filter(
    (material) => material.topicId === topicId || (!material.topicId && topicId === 'topic-1'),
  )
  const questions = mockQuestions.filter(
    (question) => question.topicId === topicId || (!question.topicId && topicId === 'topic-1'),
  )

  if (!topic) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Topic not found in this plan.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/teacher/plans/${plan.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Back to plan editor
        </Link>
      </Button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {topic.kind}
        </p>
        <h2 className="text-xl font-semibold">{topic.title}</h2>
        {topic.description && (
          <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/teacher/plans/${plan.id}/topics/${topicId}/materials`}>Manage materials</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/teacher/plans/${plan.id}/questions`}>Question bank</Link>
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Materials</CardTitle>
            <CardDescription>Learning resources attached to this topic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No materials attached yet.</p>
            ) : (
              materials.map((material) => (
                <div key={material.id} className="rounded-lg border p-3">
                  <MaterialViewer material={material} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Questions</CardTitle>
            <CardDescription>Assessment items for this topic (W4 preview).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No questions attached yet.</p>
            ) : (
              questions.map((question) => (
                <div key={question.id} className="rounded-lg border p-3">
                  <QuestionRenderer question={question} mode="review" showExplanation />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}