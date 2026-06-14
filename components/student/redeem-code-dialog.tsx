'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { redeemInviteCodeClient } from '@/lib/api/teacher-enrollments-client'

interface RedeemCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RedeemCodeDialog({ open, onOpenChange }: RedeemCodeDialogProps) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const result = await redeemInviteCodeClient(code)
      toast.success('Enrolled successfully')
      onOpenChange(false)
      setCode('')
      router.push(result.clonedPlanId ? `/learn/enrolled/${result.clonedPlanId}` : '/learn/enrolled')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to redeem code')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redeem invite code</DialogTitle>
          <DialogDescription>
            Enter the code from your teacher to enroll in their study plan.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="redeem-invite-code">Invite code</Label>
            <Input
              id="redeem-invite-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ALGO-2026"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enrolling...' : 'Enroll'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}