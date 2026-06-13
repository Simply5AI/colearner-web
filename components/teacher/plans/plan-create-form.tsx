'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createTeacherPlanClient } from '@/lib/api/teacher-plans-client'

export function PlanCreateForm() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const plan = await createTeacherPlanClient({
        title,
        description,
        subjectTags: tagsInput
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      })
      toast.success('Study plan created')
      router.push(`/teacher/plans/${plan.id}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create plan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="plan-title">Title</Label>
        <Input
          id="plan-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Algorithms 101"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-description">Description</Label>
        <Textarea
          id="plan-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What will students learn in this plan?"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="plan-tags">Subject tags</Label>
        <Input
          id="plan-tags"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="Computer Science, Mathematics"
        />
        <p className="text-xs text-muted-foreground">Comma-separated tags for filtering and discovery.</p>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting || !title.trim()}>
          {isSubmitting ? 'Creating...' : 'Create and open editor'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/teacher/plans')}>
          Cancel
        </Button>
      </div>
    </form>
  )
}