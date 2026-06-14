'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { FileUp, Plus, Sparkles } from 'lucide-react'
import { AiCoauthorModal } from '@/components/teacher/questions/ai-coauthor-modal'
import { BulkImportModal } from '@/components/teacher/questions/bulk-import-modal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TeacherQuestion, TeacherQuestionStatus, TreeNode } from '@/lib/types/teacher'
import { collectTopicOptions } from '@/lib/teacher/plan-tree-utils'

interface QuestionsListViewProps {
  planId: string
  planTree: TreeNode[]
  initialQuestions: TeacherQuestion[]
}

export function QuestionsListView({ planId, planTree, initialQuestions }: QuestionsListViewProps) {
  const [status, setStatus] = useState<TeacherQuestionStatus | 'ALL'>('ALL')
  const [aiOpen, setAiOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const topicLabels = useMemo(() => {
    const map = new Map<string, string>()
    for (const topic of collectTopicOptions(planTree)) {
      map.set(topic.id, topic.title)
    }
    return map
  }, [planTree])

  const filtered = useMemo(
    () =>
      initialQuestions.filter((question) => (status === 'ALL' ? true : question.status === status)),
    [initialQuestions, status],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select value={status} onValueChange={(value) => setStatus(value as TeacherQuestionStatus | 'ALL')}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <FileUp className="h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4" />
            AI Co-author
          </Button>
          <Button asChild>
            <Link href={`/teacher/plans/${planId}/questions/new`}>
              <Plus className="h-4 w-4" />
              New question
            </Link>
          </Button>
        </div>
      </div>

      <AiCoauthorModal
        planId={planId}
        planTree={planTree}
        open={aiOpen}
        onOpenChange={setAiOpen}
      />
      <BulkImportModal planId={planId} open={importOpen} onOpenChange={setImportOpen} />

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No questions match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((question) => (
                <tr key={question.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/teacher/plans/${planId}/questions/${question.id}`}
                      className="line-clamp-1 font-medium hover:text-primary"
                    >
                      {question.prompt}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{question.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {topicLabels.get(question.topicId) ?? question.topicId}
                  </td>
                  <td className="px-4 py-3 capitalize">{question.status.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}