'use client'

import { useState } from 'react'
import { Copy, Mail, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useInviteMember } from '@/lib/hooks/use-pods'

interface InviteMemberModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  podId: string
  podCode: string
}

export function InviteMemberModal({ open, onOpenChange, podId, podCode }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [copied, setCopied] = useState(false)
  const inviteMutation = useInviteMember()

  const handleInvite = () => {
    if (!email.trim()) return
    inviteMutation.mutate(
      { podId, email: email.trim() },
      {
        onSuccess: () => {
          setEmail('')
          onOpenChange(false)
        },
      }
    )
  }

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(podCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email invite */}
          <div>
            <label className="text-sm font-medium">Send email invite</label>
            <div className="mt-1.5 flex gap-2">
              <Input
                type="email"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
              />
              <Button
                onClick={handleInvite}
                disabled={!email.trim() || inviteMutation.isPending}
                size="sm"
              >
                <Mail className="h-4 w-4 mr-1" />
                Invite
              </Button>
            </div>
            {inviteMutation.isError && (
              <p className="mt-1 text-xs text-destructive">
                {inviteMutation.error.message}
              </p>
            )}
          </div>

          {/* Share code */}
          <div className="border-t pt-4">
            <label className="text-sm font-medium">Or share the group code</label>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">
                {podCode}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
