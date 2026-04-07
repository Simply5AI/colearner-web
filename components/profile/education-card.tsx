'use client'

import { useState } from 'react'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDeleteEducation } from '@/lib/hooks/use-profile'
import type { UserEducation, EducationLevel } from '@/lib/types'

const EDUCATION_LABELS: Record<EducationLevel, string> = {
  HIGH_SCHOOL: 'High School',
  DIPLOMA: 'Diploma',
  BACHELORS: "Bachelor's Degree",
  MASTERS: "Master's Degree",
  PHD: 'PhD / Doctorate',
  SELF_TAUGHT: 'Self-Taught',
  OTHER: 'Other',
}

interface EducationCardProps {
  education: UserEducation
  onEdit: (education: UserEducation) => void
}

export function EducationCard({ education, onEdit }: EducationCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteMutation = useDeleteEducation()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMutation.mutateAsync(education.id)
      toast.success('Education entry removed')
    } catch {
      toast.error('Failed to remove education entry')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-start justify-between rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {EDUCATION_LABELS[education.educationLevel] || education.educationLevel}
        </p>
        <p className="text-sm text-muted-foreground">{education.fieldOfStudy}</p>
        {education.institution && (
          <p className="text-xs text-muted-foreground mt-0.5">{education.institution}</p>
        )}
        {education.isCurrent && (
          <span className="inline-block mt-1 text-[10px] font-medium text-brand-orange bg-brand-orange/10 rounded-full px-2 py-0.5">
            Currently Studying
          </span>
        )}
      </div>
      <div className="flex gap-1 ml-2">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onEdit(education)}
          className="h-7 w-7"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}
