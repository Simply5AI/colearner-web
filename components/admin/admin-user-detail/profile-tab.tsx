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
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ProfileTabProps {
  detail: AdminUserDetail
  authHeaders: Record<string, string>
}

type EditField = 'name' | 'email' | null

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
  const [editingField, setEditingField] = useState<EditField>(null)
  const [name, setName] = useState(detail.name)
  const [email, setEmail] = useState(detail.email)
  const [busy, setBusy] = useState(false)

  const closeEditor = () => {
    setEditingField(null)
    setName(detail.name)
    setEmail(detail.email)
  }

  const openEditor = (field: EditField) => {
    setName(detail.name)
    setEmail(detail.email)
    setEditingField(field)
  }

  const save = async () => {
    if (editingField === 'name') {
      if (!name.trim() || name.trim() === detail.name) {
        closeEditor()
        return
      }
      setBusy(true)
      try {
        await runSensitive(() =>
          patchAdminUser(authHeaders, detail.id, { name: name.trim() })
        )
        toast.success('Name updated')
        setEditingField(null)
        startTransition(() => router.refresh())
      } catch (error) {
        toast.error('Failed to update name', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setBusy(false)
      }
      return
    }

    if (editingField === 'email') {
      const nextEmail = email.trim().toLowerCase()
      if (!EMAIL_PATTERN.test(nextEmail)) {
        toast.error('Enter a valid email address')
        return
      }
      if (nextEmail === detail.email.toLowerCase()) {
        closeEditor()
        return
      }
      setBusy(true)
      try {
        await runSensitive(() =>
          patchAdminUser(authHeaders, detail.id, { email: nextEmail })
        )
        toast.success('Email updated')
        setEditingField(null)
        startTransition(() => router.refresh())
      } catch (error) {
        toast.error('Failed to update email', {
          description: error instanceof Error ? error.message : undefined,
        })
      } finally {
        setBusy(false)
      }
    }
  }

  const canEdit = detail.status !== 'DELETED'

  return (
    <>
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Name"
            value={
              <span className="inline-flex items-center gap-2">
                {detail.name}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    disabled={isPending}
                    onClick={() => openEditor('name')}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </span>
            }
          />
          <Field
            label="Email"
            value={
              <span className="inline-flex items-center gap-2">
                {detail.email}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    disabled={isPending}
                    onClick={() => openEditor('email')}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </span>
            }
          />
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

      <Dialog open={editingField !== null} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingField === 'email' ? 'Edit email' : 'Edit name'}</DialogTitle>
            <DialogDescription>
              {editingField === 'email'
                ? 'Changing the login email requires step-up authentication and is audited.'
                : 'Update the display name for this account.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-2">
            {editingField === 'name' ? (
              <>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                />
              </>
            ) : (
              <>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                />
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={
                busy ||
                (editingField === 'name' && !name.trim()) ||
                (editingField === 'email' && !email.trim())
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}