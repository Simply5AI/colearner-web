'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { format } from 'date-fns'

import { patchAdminUser, type AdminUserDetail } from '@/lib/api/admin'
import { useAdminMutation } from '@/lib/hooks/use-admin-mutation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ProfileTabProps {
  detail: AdminUserDetail
  authHeaders: Record<string, string>
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  )
}

function formatDateOrDash(value: string | null) {
  if (!value) return '—'
  try {
    return format(new Date(value), 'PP p')
  } catch {
    return value
  }
}

export function ProfileTab({ detail, authHeaders }: ProfileTabProps) {
  const router = useRouter()
  const { runSensitive } = useAdminMutation()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(detail.name)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim() || name.trim() === detail.name) {
      setEditing(false)
      return
    }
    setBusy(true)
    try {
      await runSensitive(() =>
        patchAdminUser(authHeaders, detail.id, { name: name.trim() })
      )
      toast.success('Name updated')
      setEditing(false)
      startTransition(() => router.refresh())
    } catch (error) {
      toast.error('Failed to update name', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Name"
            value={
              <span className="inline-flex items-center gap-2">
                {detail.name}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  disabled={detail.status === 'DELETED' || isPending}
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </span>
            }
          />
          <Field label="Email" value={detail.email} />
          <Field label="System role" value={detail.systemRole} />
          <Field
            label="Organization"
            value={
              <span>
                {detail.org.name} <span className="text-muted-foreground">({detail.org.slug})</span>
              </span>
            }
          />
          <Field label="Org type" value={detail.org.type} />
          <Field
            label="Plan"
            value={
              detail.subscription ? (
                <span>
                  {detail.subscription.plan} · {detail.subscription.status}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Field label="Created" value={formatDateOrDash(detail.createdAt)} />
          <Field label="Last active" value={formatDateOrDash(detail.lastActiveAt)} />
          <Field
            label="Onboarding"
            value={detail.onboardingCompleted ? 'Completed' : 'In progress'}
          />
          {detail.status === 'SUSPENDED' && (
            <>
              <Field label="Suspended at" value={formatDateOrDash(detail.suspendedAt)} />
              <Field label="Suspension reason" value={detail.suspensionReason ?? '—'} />
            </>
          )}
          {detail.status === 'DELETED' && (
            <Field label="Deleted at" value={formatDateOrDash(detail.deletedAt)} />
          )}
          {detail.bio && (
            <div className="md:col-span-2 lg:col-span-3">
              <Field label="Bio" value={detail.bio} />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={(v) => !v && setEditing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit name</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
