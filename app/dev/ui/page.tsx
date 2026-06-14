'use client'

import { useState } from 'react'
import { QuestionEditor } from '@/components/questions/QuestionEditor'
import { QuestionRenderer } from '@/components/questions/QuestionRenderer'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { TreeEditor } from '@/components/tree/TreeEditor'
import { UploaderDropzone } from '@/components/uploads/UploaderDropzone'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { MasteryBadge } from '@/components/shared/MasteryBadge'
import { ScoreChip } from '@/components/shared/ScoreChip'
import {
  mockMaterials,
  mockQuestions,
  mockRichTextContent,
  mockTreeNodes,
} from '@/lib/fixtures/teacher-ui'
import type { TeacherAnswerValue, TreeNode } from '@/lib/types/teacher'

export default function TeacherUiDevPage() {
  const [answer, setAnswer] = useState<TeacherAnswerValue | undefined>()
  const [treeNodes, setTreeNodes] = useState<TreeNode[]>(mockTreeNodes)
  const [richText, setRichText] = useState<Record<string, unknown>>(mockRichTextContent)

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Teacher UI Primitives (W8)</h1>
        <p className="text-sm text-muted-foreground">
          Dev showcase for TASK-12 shared components.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Dashboard primitives</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <ProgressBar value={68} label="Course progress" />
          <MasteryBadge level="review" />
          <ScoreChip score={82} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">QuestionRenderer (attempt)</h2>
        <div className="rounded-xl border p-4">
          <QuestionRenderer
            question={mockQuestions[0]!}
            mode="attempt"
            answer={answer}
            onAnswer={setAnswer}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Question types (review)</h2>
        <div className="grid gap-4">
          {mockQuestions.map((question) => (
            <div key={question.id} className="rounded-xl border p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {question.type}
              </p>
              <QuestionRenderer question={question} mode="review" showExplanation />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">QuestionEditor</h2>
        <div className="rounded-xl border p-4">
          <QuestionEditor
            onSave={() => undefined}
            onCancel={() => undefined}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">MaterialViewer</h2>
        <div className="grid gap-4">
          {mockMaterials.map((material) => (
            <div key={material.id} className="rounded-xl border p-4">
              <MaterialViewer material={material} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">RichTextEditor</h2>
        <RichTextEditor value={richText} onChange={setRichText} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">TreeEditor</h2>
        <TreeEditor
          nodes={treeNodes}
          onReorder={setTreeNodes}
          onRename={(nodeId, title) => {
            function rename(nodes: TreeNode[]): TreeNode[] {
              return nodes.map((node) =>
                node.id === nodeId
                  ? { ...node, title }
                  : { ...node, children: node.children ? rename(node.children) : node.children },
              )
            }
            setTreeNodes((current) => rename(current))
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">UploaderDropzone</h2>
        <UploaderDropzone />
      </section>
    </div>
  )
}