'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TeacherQuestion, TeacherQuestionStatus } from '@/lib/types/teacher'

interface QuestionsListViewProps {
  planId: string
  initialQuestions: TeacherQuestion[]
}

export function QuestionsListView({ planId, initialQuestions }: QuestionsListViewProps) {
  const [status, setStatus] = useState<TeacherQuestionStatus | 'ALL'>('ALL')

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
        <Button asChild>
          <Link href={`/teacher/plans/${planId}/questions/new`}>
            <Plus className="h-4 w-4" />
            New question
          </Link>
        </Button>
      </div>

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
                  <td className="px-4 py-3 text-muted-foreground">{question.topicId}</td>
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