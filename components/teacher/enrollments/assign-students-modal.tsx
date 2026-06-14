'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
  assignStudentsClient,
  listOrgStudentsClient,
} from '@/lib/api/teacher-enrollments-client'
import type { OrgStudentOption } from '@/lib/types/teacher'

interface AssignStudentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  enrolledStudentIds: string[]
  onAssigned: () => void
}

export function AssignStudentsModal({
  open,
  onOpenChange,
  planId,
  enrolledStudentIds,
  onAssigned,
}: AssignStudentsModalProps) {
  const [search, setSearch] = useState('')
  const [students, setStudents] = useState<OrgStudentOption[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setIsLoading(true)
    void listOrgStudentsClient(search || undefined)
      .then(setStudents)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load students')
      })
      .finally(() => setIsLoading(false))
  }, [open, search])

  const enrolledSet = useMemo(() => new Set(enrolledStudentIds), [enrolledStudentIds])
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, checked]) => checked).map(([id]) => id),
    [selected],
  )

  async function handleAssign() {
    if (selectedIds.length === 0) return
    setIsSubmitting(true)
    try {
      const result = await assignStudentsClient(planId, selectedIds)
      const assigned = result.results.filter((entry) => entry.status === 'assigned').length
      const skipped = result.results.filter((entry) => entry.status === 'skipped').length
      toast.success(`Assigned ${assigned} student${assigned === 1 ? '' : 's'}${skipped ? `, skipped ${skipped}` : ''}`)
      onOpenChange(false)
      setSelected({})
      onAssigned()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign students')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>Assign students</DialogTitle>
          <DialogDescription>
            Select learners from your organization to enroll in this published plan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="student-search">Search</Label>
            <Input
              id="student-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading students...</p>
            ) : students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students found in your organization.</p>
            ) : (
              students.map((student) => {
                const alreadyEnrolled = enrolledSet.has(student.userId)
                return (
                  <label
                    key={student.userId}
                    className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/40"
                  >
                    <Checkbox
                      checked={alreadyEnrolled || !!selected[student.userId]}
                      disabled={alreadyEnrolled}
                      onCheckedChange={(checked) =>
                        setSelected((current) => ({
                          ...current,
                          [student.userId]: checked === true,
                        }))
                      }
                    />
                    <div>
                      <p className="text-sm font-medium">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                      {alreadyEnrolled && (
                        <p className="text-xs text-primary">Already enrolled</p>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || selectedIds.length === 0}
            onClick={() => void handleAssign()}
          >
            {isSubmitting ? 'Assigning...' : `Assign ${selectedIds.length || ''} students`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}