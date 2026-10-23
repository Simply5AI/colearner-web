'use client'

import type { ComponentProps } from 'react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AssignClassPanel } from '@/components/teacher/plans/assign-class-panel'

type AssignedHandler = ComponentProps<typeof AssignClassPanel>['onAssigned']

/** Hosts W2's AssignClassPanel; the panel owns the API, copy and roster summary. */
export function AssignDialog({
  open,
  onOpenChange,
  planId,
  onAssigned,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  planId: string
  onAssigned: AssignedHandler
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Assign to class</DialogTitle>
          <DialogDescription>Students see the plan once it is assigned. Learners under 18 also need a guardian to approve.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <AssignClassPanel planId={planId} onAssigned={onAssigned} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
