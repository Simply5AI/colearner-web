'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddEducation, useUpdateEducation } from '@/lib/hooks/use-profile'
import type { UserEducation, EducationLevel } from '@/lib/types'

const EDUCATION_LEVELS: { value: EducationLevel; label: string }[] = [
  { value: 'HIGH_SCHOOL', label: 'High School' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'BACHELORS', label: "Bachelor's Degree" },
  { value: 'MASTERS', label: "Master's Degree" },
  { value: 'PHD', label: 'PhD / Doctorate' },
  { value: 'SELF_TAUGHT', label: 'Self-Taught' },
  { value: 'OTHER', label: 'Other' },
]

interface AddEducationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData?: UserEducation | null
}

export function AddEducationDialog({ open, onOpenChange, editData }: AddEducationDialogProps) {
  const addMutation = useAddEducation()
  const updateMutation = useUpdateEducation()

  const [educationLevel, setEducationLevel] = useState<EducationLevel>('BACHELORS')
  const [fieldOfStudy, setFieldOfStudy] = useState('')
  const [institution, setInstitution] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)

  useEffect(() => {
    if (editData) {
      setEducationLevel(editData.educationLevel)
      setFieldOfStudy(editData.fieldOfStudy)
      setInstitution(editData.institution || '')
      setIsCurrent(editData.isCurrent)
    } else {
      setEducationLevel('BACHELORS')
      setFieldOfStudy('')
      setInstitution('')
      setIsCurrent(false)
    }
  }, [editData, open])

  const isPending = addMutation.isPending || updateMutation.isPending

  const handleSubmit = async () => {
    if (!fieldOfStudy.trim()) {
      toast.error('Field of study is required')
      return
    }

    const data = {
      educationLevel,
      fieldOfStudy: fieldOfStudy.trim(),
      institution: institution.trim() || undefined,
      isCurrent,
    }

    try {
      if (editData) {
        await updateMutation.mutateAsync({ id: editData.id, data })
        toast.success('Education updated')
      } else {
        await addMutation.mutateAsync(data)
        toast.success('Education added')
      }
      onOpenChange(false)
    } catch {
      toast.error(editData ? 'Failed to update education' : 'Failed to add education')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Education' : 'Add Education'}</DialogTitle>
          <DialogDescription>
            {editData ? 'Update your education details.' : 'Add your educational background.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edu-level">Education Level</Label>
            <select
              id="edu-level"
              value={educationLevel}
              onChange={(e) => setEducationLevel(e.target.value as EducationLevel)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {EDUCATION_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-of-study">Field of Study</Label>
            <Input
              id="field-of-study"
              value={fieldOfStudy}
              onChange={(e) => setFieldOfStudy(e.target.value)}
              placeholder="e.g. Computer Science"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="institution">Institution (optional)</Label>
            <Input
              id="institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. MIT"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm">Currently studying</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editData ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
