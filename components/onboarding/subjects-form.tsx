'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { getDisplaySubjects } from '@/lib/constants/subjects'
import { useSubjects, useUpdateOnboardingSubjects } from '@/lib/hooks/use-onboarding'
import { cn } from '@/lib/utils'

export function SubjectsForm() {
  const router = useRouter()
  const { data: subjects = [], isLoading } = useSubjects()
  const updateSubjects = useUpdateOnboardingSubjects()
  const [selected, setSelected] = useState<string[]>([])
  const displaySubjects = getDisplaySubjects(subjects)

  function toggleSubject(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  async function submit(subjectIds: string[]) {
    try {
      await updateSubjects.mutateAsync(subjectIds)
      router.push('/onboarding/education')
    } catch {
      toast.error('Could not save subjects', {
        description: 'Please try again.',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading subjects...
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {displaySubjects.map((subject) => {
          const isSelected = selected.includes(subject.id)
          return (
            <button
              key={subject.id}
              type="button"
              onClick={() => toggleSubject(subject.id)}
              className={cn(
                'flex min-h-16 items-center gap-3 rounded-xl border-2 p-4 text-left transition-all',
                isSelected
                  ? 'border-brand-orange bg-brand-orange/5'
                  : 'border-border hover:border-brand-orange/40',
              )}
            >
              <Checkbox
                checked={isSelected}
                className="pointer-events-none border-brand-orange data-checked:bg-brand-orange"
              />
              <span>
                <span className="block text-sm font-bold">{subject.name}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">School subject</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 flex-1"
          disabled={updateSubjects.isPending}
          onClick={() => submit([])}
        >
          Skip for now
        </Button>
        <Button
          type="button"
          className="h-12 flex-1 bg-brand-orange text-sm font-bold text-white hover:bg-brand-orange-dark"
          disabled={selected.length === 0 || updateSubjects.isPending}
          onClick={() => submit(selected)}
        >
          {updateSubjects.isPending ? 'Saving...' : 'Continue ->'}
        </Button>
      </div>
    </div>
  )
}
