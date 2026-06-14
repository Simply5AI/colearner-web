'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { listTeacherMaterialsClient } from '@/lib/api/teacher-materials-client'
import { generateAiDraftsClient, publishTeacherQuestionClient } from '@/lib/api/teacher-questions-client'
import { collectTopicOptions } from '@/lib/teacher/plan-tree-utils'
import type { TeacherMaterial, TeacherQuestionType, TreeNode } from '@/lib/types/teacher'

const QUESTION_TYPES: TeacherQuestionType[] = [
  'MCQ',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'LONG_ANSWER',
]

interface AiCoauthorModalProps {
  planId: string
  planTree: TreeNode[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiCoauthorModal({ planId, planTree, open, onOpenChange }: AiCoauthorModalProps) {
  const router = useRouter()
  const topicOptions = useMemo(() => collectTopicOptions(planTree), [planTree])
  const [topicId, setTopicId] = useState(topicOptions[0]?.id ?? '')
  const [count, setCount] = useState(3)
  const [difficultyHint, setDifficultyHint] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<TeacherQuestionType[]>(['MCQ', 'TRUE_FALSE'])
  const [materials, setMaterials] = useState<TeacherMaterial[]>([])
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !planId) return
    listTeacherMaterialsClient({ planId, topicId: topicId || undefined })
      .then(setMaterials)
      .catch(() => setMaterials([]))
  }, [open, planId, topicId])

  function toggleType(type: TeacherQuestionType) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  function toggleMaterial(id: string) {
    setMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    )
  }

  async function handleGenerate(publishAll: boolean) {
    if (!topicId) {
      toast.error('Select a topic')
      return
    }
    if (selectedTypes.length === 0) {
      toast.error('Select at least one question type')
      return
    }
    if (count > 5) {
      toast.error('Synchronous AI draft supports up to 5 questions')
      return
    }

    setLoading(true)
    try {
      const result = await generateAiDraftsClient({
        planId,
        topicId,
        materialIds: materialIds.length > 0 ? materialIds : undefined,
        types: selectedTypes,
        count,
        difficultyHint: difficultyHint || undefined,
      })

      if (publishAll) {
        await Promise.all(result.questions.map((q) => publishTeacherQuestionClient(q.id)))
      }

      toast.success(
        publishAll
          ? `Generated and published ${result.generated} questions`
          : `Generated ${result.generated} draft questions`,
      )
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI draft failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Co-author
          </DialogTitle>
          <DialogDescription>
            Generate draft questions from topic materials. Review and edit before publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Topic</Label>
            <Select value={topicId} onValueChange={(value) => setTopicId(value ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {topicOptions.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Question types</Label>
            <div className="flex flex-wrap gap-3">
              {QUESTION_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={() => toggleType(type)}
                  />
                  {type.replace('_', ' ')}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ai-count">Count (1–5)</Label>
              <Input
                id="ai-count"
                type="number"
                min={1}
                max={5}
                value={count}
                onChange={(e) => setCount(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-difficulty">Difficulty hint</Label>
              <Input
                id="ai-difficulty"
                placeholder="e.g. beginner"
                value={difficultyHint}
                onChange={(e) => setDifficultyHint(e.target.value)}
              />
            </div>
          </div>

          {materials.length > 0 && (
            <div className="space-y-2">
              <Label>Reference materials (optional)</Label>
              <div className="max-h-32 space-y-2 overflow-y-auto rounded-md border p-2">
                {materials.map((material) => (
                  <label key={material.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={materialIds.includes(material.id)}
                      onCheckedChange={() => toggleMaterial(material.id)}
                    />
                    {material.title}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleGenerate(false)} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save drafts
          </Button>
          <Button onClick={() => handleGenerate(true)} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate & publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}