'use client'

import Link from 'next/link'
import { ArrowLeft, BookOpen, ClipboardList } from 'lucide-react'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { findTreeNode } from '@/lib/teacher/plan-tree-utils'
import type { StudentEnrolledPlan } from '@/lib/types/student-enrollment'

interface EnrolledTopicViewProps {
  plan: StudentEnrolledPlan
  topicId: string
}

export function EnrolledTopicView({ plan, topicId }: EnrolledTopicViewProps) {
  const topic = findTreeNode(plan.tree, topicId)
  const materials = plan.materialsByTopic[topicId] ?? []
  const questionCount = plan.questionCountsByTopic[topicId] ?? 0

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
      <Link
        href={`/learn/enrolled/${plan.id}`}
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), '-ml-2')}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to plan
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {topic.kind}
        </p>
        <h1 className="text-2xl font-bold">{topic.title}</h1>
        {topic.description && (
          <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materials</CardTitle>
          <CardDescription>{materials.length} learning resources for this topic.</CardDescription>
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
          <CardTitle className="text-base">Practice & exam</CardTitle>
          <CardDescription>
            {questionCount} published questions available for this topic.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" disabled title="Practice sessions coming in B6">
            <BookOpen className="mr-2 h-4 w-4" />
            Practice
          </Button>
          <Button variant="outline" disabled title="Exam sessions coming in B6">
            <ClipboardList className="mr-2 h-4 w-4" />
            Exam
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}