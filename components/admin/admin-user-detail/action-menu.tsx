'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, KeyRound, ShieldAlert, Trash2, UserCheck } from 'lucide-react'

import {
  deleteAdminUser,
  reactivateAdminUser,
  resetAdminUserPassword,
  suspendAdminUser,
  type AdminUserDetail,
} from '@/lib/api/admin'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Textarea } from '@/components/ui/textarea'

type AdminAction = 'suspend' | 'reactivate' | 'reset-password' | 'delete'

interface ActionMenuProps {
  detail: AdminUserDetail
  currentAdminId: string
  authHeaders: Record<string, string>
}

export function AdminUserActionMenu({ detail, currentAdminId, authHeaders }: ActionMenuProps) {
  const router = useRouter()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState<AdminAction | null>(null)
  const [reason, setReason] = useState('')
  const [emailConfirm, setEmailConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const isSelf = detail.id === currentAdminId
  const isDeleted = detail.status === 'DELETED'
  const isSuspended = detail.status === 'SUSPENDED'

  const close = () => {
    setOpen(null)
    setReason('')
    setEmailConfirm('')
  }

  const refresh = () => {
    startTransition(() => {
      router.refresh()
    })
  }

  const runSuspend = async () => {
    if (!reason.trim()) {
      toast.error('A reason is required to suspend')
      return
    }
    setBusy(true)
    try {
      await runSensitive(() =>
        suspendAdminUser(authHeaders, detail.id, { reason: reason.trim() })
      )
      toast.success(`Suspended ${detail.email}`)
      close()
      refresh()
    } catch (error) {
      toast.error('Suspend failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const runReactivate = async () => {
    setBusy(true)
    try {
      await runSensitive(() => reactivateAdminUser(authHeaders, detail.id))
      toast.success(`Reactivated ${detail.email}`)
      close()
      refresh()
    } catch (error) {
      toast.error('Reactivate failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const runResetPassword = async () => {
    setBusy(true)
    try {
      await runSensitive(() => resetAdminUserPassword(authHeaders, detail.id))
      toast.success(`Password-reset email sent to ${detail.email}`)
      close()
    } catch (error) {
      toast.error('Reset password failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    if (emailConfirm.trim().toLowerCase() !== detail.email.toLowerCase()) {
      toast.error('Email confirmation does not match')
      return
    }
    setBusy(true)
    try {
      await runSensitive(() => deleteAdminUser(authHeaders, detail.id))
      toast.success(`Deleted ${detail.email}`)
      close()
      refresh()
    } catch (error) {
      toast.error('Delete failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="sm" disabled={isPending} />}
        >
          <MoreHorizontal className="h-4 w-4" />
          Actions
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!isSuspended && !isDeleted && (
            <DropdownMenuItem
              disabled={isSelf}
              onClick={() => setOpen('suspend')}
            >
              <ShieldAlert className="h-4 w-4" />
              Suspend
            </DropdownMenuItem>
          )}
          {isSuspended && !isDeleted && (
            <DropdownMenuItem onClick={() => setOpen('reactivate')}>
              <UserCheck className="h-4 w-4" />
              Reactivate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={isDeleted}
            onClick={() => setOpen('reset-password')}
          >
            <KeyRound className="h-4 w-4" />
            Reset password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSelf || isDeleted}
            onClick={() => setOpen('delete')}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete user
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open === 'suspend'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {detail.name}?</DialogTitle>
            <DialogDescription>
              The user will be immediately signed out of all devices and blocked from signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="suspend-reason">Reason (required)</Label>
            <Textarea
              id="suspend-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Violated terms of service…"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runSuspend} disabled={busy || !reason.trim()}>
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'reactivate'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reactivate {detail.name}?</DialogTitle>
            <DialogDescription>
              The user will regain the ability to sign in. Previous sessions remain revoked.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runReactivate} disabled={busy}>
              Reactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'reset-password'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send password-reset email?</DialogTitle>
            <DialogDescription>
              A one-time reset link valid for 1 hour will be emailed to {detail.email}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={runResetPassword} disabled={busy}>
              Send reset email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open === 'delete'} onOpenChange={(v) => !v && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {detail.name}?</DialogTitle>
            <DialogDescription>
              Soft-deletes the account. Type the user&apos;s email to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Email confirmation</Label>
            <Input
              id="delete-confirm"
              value={emailConfirm}
              onChange={(e) => setEmailConfirm(e.target.value)}
              placeholder={detail.email}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={runDelete}
              disabled={busy || emailConfirm.trim().toLowerCase() !== detail.email.toLowerCase()}
            >
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
