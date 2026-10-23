'use client'

import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { TeachingPlanDetail } from '@/lib/api/teaching/plans'
import { NewPlanOptions } from './new-plan-options'

/** T2 "New plan dialog". Closing it never discards a created plan; a failed create leaves the dialog and its fields in place. */
export function NewPlanDialog({ open, onOpenChange, onCreated, defaultClassId }: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreated: (plan: TeachingPlanDetail) => void; defaultClassId?: string
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl" data-testid="new-plan-dialog">
      <DialogHeader><DialogTitle>New plan</DialogTitle><DialogDescription>Choose how to start, then pick the class, subject and age band.</DialogDescription></DialogHeader>
      <DialogBody>{open && <NewPlanOptions onCreated={onCreated} defaultClassId={defaultClassId} />}</DialogBody>
    </DialogContent>
  </Dialog>
}
