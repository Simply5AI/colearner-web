'use client'

import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Archive,
  ArrowLeft,
  Building2,
  ChevronDown,
  MoreHorizontal,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  archiveAdminOrg,
  getAdminOrgMembers,
  inviteAdminOrgMember,
  patchAdminOrg,
  removeAdminOrgMember,
  transferAdminOrgOwnership,
  updateAdminOrgMemberRole,
  updateAdminOrgPlan,
  type AdminBillingCycle,
  type AdminOrgDetail,
  type AdminOrgMember,
  type AdminOrgMembersResponse,
  type AdminOrgRoleOption,
  type AdminOrgType,
  type AdminSubscriptionPlan,
} from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const ORG_TYPES: AdminOrgType[] = ['PERSONAL', 'TEAM', 'ENTERPRISE']
const PLANS: AdminSubscriptionPlan[] = ['FREE', 'PRO', 'ENTERPRISE']
const BILLING_CYCLES: AdminBillingCycle[] = ['MONTHLY', 'YEARLY']
const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type DialogState = 'plan' | 'transfer' | 'archive' | 'invite' | null

interface AdminOrgDetailViewProps {
  detail: AdminOrgDetail
  initialMembers: AdminOrgMembersResponse
}

export function AdminOrgDetailView({ detail, initialMembers }: AdminOrgDetailViewProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {}
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`
    return headers
  }, [session?.accessToken])

  const [members, setMembers] = useState(initialMembers.items)
  const [nextMembersCursor, setNextMembersCursor] = useState(initialMembers.nextCursor)
  const [busy, setBusy] = useState(false)
  const [dialog, setDialog] = useState<DialogState>(null)
  const [transferUserId, setTransferUserId] = useState('')
  const [archiveConfirm, setArchiveConfirm] = useState('')
  const [removeTarget, setRemoveTarget] = useState<AdminOrgMember | null>(null)
  const [roleTarget, setRoleTarget] = useState<AdminOrgMember | null>(null)
  const [roleId, setRoleId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState(defaultRoleId(detail.availableRoles))
  const [plan, setPlan] = useState<AdminSubscriptionPlan>(detail.plan)
  const [billingCycle, setBillingCycle] = useState<AdminBillingCycle>(detail.billingCycle ?? 'MONTHLY')
  const [settings, setSettings] = useState({
    name: detail.name,
    slug: detail.slug,
    type: detail.type,
    ssoEnabled: detail.ssoEnabled,
  })
  const [settingsError, setSettingsError] = useState<string | null>(null)

  useEffect(() => {
    setMembers(initialMembers.items)
    setNextMembersCursor(initialMembers.nextCursor)
  }, [initialMembers.items, initialMembers.nextCursor])

  useEffect(() => {
    setPlan(detail.plan)
    setBillingCycle(detail.billingCycle ?? 'MONTHLY')
    setSettings({
      name: detail.name,
      slug: detail.slug,
      type: detail.type,
      ssoEnabled: detail.ssoEnabled,
    })
    setInviteRoleId(defaultRoleId(detail.availableRoles))
  }, [detail])

  const ownerMember = members.find((member) => member.id === detail.owner?.id)
  const isArchived = Boolean(detail.deletedAt)
  const canToggleSso = detail.type === 'ENTERPRISE' && !isArchived

  const refresh = () => startTransition(() => router.refresh())

  const requireAuth = () => {
    if (authHeaders.Authorization) return true
    toast.error('Admin session is missing an access token')
    return false
  }

  const loadMoreMembers = async () => {
    if (!nextMembersCursor || !requireAuth()) return
    setBusy(true)
    try {
      const response = await getAdminOrgMembers(authHeaders, detail.id, {
        cursor: nextMembersCursor,
        limit: 100,
      })
      setMembers((current) => [...current, ...response.items])
      setNextMembersCursor(response.nextCursor)
    } catch (error) {
      toast.error('Members failed to load', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleSso = async () => {
    if (!canToggleSso || !requireAuth()) return
    setBusy(true)
    try {
      await patchAdminOrg(authHeaders, detail.id, {
        ssoEnabled: !detail.ssoEnabled,
        updatedAt: detail.updatedAt,
      })
      toast.success(detail.ssoEnabled ? 'SSO disabled' : 'SSO enabled')
      refresh()
    } catch (error) {
      toast.error('SSO update failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const savePlan = async () => {
    if (!requireAuth()) return
    setBusy(true)
    try {
      await updateAdminOrgPlan(authHeaders, detail.id, { plan, billingCycle })
      toast.success('Plan updated')
      setDialog(null)
      refresh()
    } catch (error) {
      toast.error('Plan update failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const transferOwnership = async () => {
    if (!transferUserId || !requireAuth()) return
    setBusy(true)
    try {
      await transferAdminOrgOwnership(authHeaders, detail.id, transferUserId)
      toast.success('Ownership transferred')
      setDialog(null)
      setTransferUserId('')
      refresh()
    } catch (error) {
      toast.error('Transfer failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const archiveOrg = async () => {
    if (!requireAuth()) return
    if (archiveConfirm.trim() !== detail.slug) {
      toast.error('Slug confirmation does not match')
      return
    }
    setBusy(true)
    try {
      await archiveAdminOrg(authHeaders, detail.id)
      toast.success('Organization archived')
      setDialog(null)
      setArchiveConfirm('')
      refresh()
    } catch (error) {
      toast.error('Archive failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const inviteMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!requireAuth()) return
    if (!EMAIL_PATTERN.test(inviteEmail.trim())) {
      toast.error('Enter a valid email address')
      return
    }
    if (!inviteRoleId) {
      toast.error('Select a role')
      return
    }
    setBusy(true)
    try {
      const member = await inviteAdminOrgMember(authHeaders, detail.id, {
        email: inviteEmail.trim().toLowerCase(),
        roleId: inviteRoleId,
      })
      setMembers((current) => [member, ...current])
      toast.success('Member invited')
      setDialog(null)
      setInviteEmail('')
      setInviteRoleId(defaultRoleId(detail.availableRoles))
      refresh()
    } catch (error) {
      toast.error('Invite failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async () => {
    if (!removeTarget || !requireAuth()) return
    setBusy(true)
    try {
      await removeAdminOrgMember(authHeaders, detail.id, removeTarget.id)
      setMembers((current) => current.filter((member) => member.id !== removeTarget.id))
      toast.success(`Removed ${removeTarget.email}`)
      setRemoveTarget(null)
      refresh()
    } catch (error) {
      toast.error('Remove failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const changeMemberRole = async () => {
    if (!roleTarget || !roleId || !requireAuth()) return
    setBusy(true)
    try {
      await updateAdminOrgMemberRole(authHeaders, detail.id, roleTarget.id, roleId)
      const nextRole = detail.availableRoles.find((role) => role.id === roleId)
      setMembers((current) =>
        current.map((member) =>
          member.id === roleTarget.id
            ? { ...member, roleId, role: nextRole?.name ?? member.role }
            : member
        )
      )
      toast.success('Role updated')
      setRoleTarget(null)
      setRoleId('')
      refresh()
    } catch (error) {
      toast.error('Role update failed', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSettingsError(null)
    const name = settings.name.trim()
    const slug = settings.slug.trim().toLowerCase()
    if (!name) {
      setSettingsError('Name is required.')
      return
    }
    if (!SLUG_PATTERN.test(slug)) {
      setSettingsError('Slug must be 3 to 40 lowercase letters, numbers, or hyphens.')
      return
    }
    if (!requireAuth()) return

    setBusy(true)
    try {
      await patchAdminOrg(authHeaders, detail.id, {
        name,
        slug,
        type: settings.type,
        ssoEnabled: settings.type === 'ENTERPRISE' ? settings.ssoEnabled : false,
        updatedAt: detail.updatedAt,
      })
      toast.success('Organization settings saved')
      refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      setSettingsError(message)
      toast.error('Settings update failed', { description: message })
    } finally {
      setBusy(false)
    }
  }

  const openTransfer = () => {
    setTransferUserId(ownerMember?.id ?? members[0]?.id ?? '')
    setDialog('transfer')
  }

  const openRoleDialog = (member: AdminOrgMember) => {
    setRoleTarget(member)
    setRoleId(member.roleId ?? defaultRoleId(detail.availableRoles))
  }

  return (
    <TooltipProvider>
      <div className="px-4 py-5 md:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href="/admin/orgs"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to organizations
          </Link>
        </div>

        <div className="mb-6 flex flex-wrap items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback>{initials(detail.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{detail.name}</h1>
              <StatusBadge archived={isArchived} />
              <Badge variant="outline">{formatEnum(detail.type)}</Badge>
              <Badge variant={detail.plan === 'ENTERPRISE' ? 'default' : 'secondary'}>
                {formatPlan(detail.plan)}
              </Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{detail.slug}</span>
              <span className="mx-2">/</span>
              Owner: {detail.owner?.email ?? 'No owner'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
              <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
              Refresh
            </Button>
            <OrgActionMenu
              archived={isArchived}
              canToggleSso={canToggleSso}
              ssoEnabled={detail.ssoEnabled}
              onPlan={() => setDialog('plan')}
              onToggleSso={toggleSso}
              onTransfer={openTransfer}
              onArchive={() => setDialog('archive')}
              busy={busy}
            />
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="members">
              Members
              <span className="ml-1 opacity-60">{detail.stats.memberCount}</span>
            </TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <OverviewTab detail={detail} />
          </TabsContent>
          <TabsContent value="members" className="mt-4">
            <MembersTab
              members={members}
              ownerId={detail.owner?.id ?? null}
              roles={detail.availableRoles}
              nextCursor={nextMembersCursor}
              busy={busy}
              onInvite={() => setDialog('invite')}
              onLoadMore={loadMoreMembers}
              onRemove={setRemoveTarget}
              onChangeRole={openRoleDialog}
            />
          </TabsContent>
          <TabsContent value="subscription" className="mt-4">
            <SubscriptionTab detail={detail} onChangePlan={() => setDialog('plan')} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <SettingsTab
              detail={detail}
              settings={settings}
              setSettings={setSettings}
              error={settingsError}
              busy={busy}
              onSubmit={saveSettings}
              onArchive={() => setDialog('archive')}
            />
          </TabsContent>
        </Tabs>

        <Dialog open={dialog === 'plan'} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change plan</DialogTitle>
              <DialogDescription>
                The v1 backend applies plan changes immediately and records the audit trail.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Plan</Label>
                <Select value={plan} onValueChange={(value) => setPlan(value as AdminSubscriptionPlan)}>
                  <SelectTrigger aria-label="Plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatPlan(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing cycle</Label>
                <Select
                  value={billingCycle}
                  onValueChange={(value) => setBillingCycle(value as AdminBillingCycle)}
                >
                  <SelectTrigger aria-label="Billing cycle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {formatEnum(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={savePlan} disabled={busy}>
                Save plan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'transfer'} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer ownership</DialogTitle>
              <DialogDescription>
                The new owner must already be an active member of this organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>New owner</Label>
              <Select value={transferUserId} onValueChange={(value) => setTransferUserId(value ?? '')}>
                <SelectTrigger aria-label="New owner">
                  <SelectValue placeholder="Select a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={transferOwnership} disabled={busy || !transferUserId}>
                Transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'archive'} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive organization</DialogTitle>
              <DialogDescription>
                Type <span className="font-mono text-foreground">{detail.slug}</span> to confirm. Active subscriptions are canceled by the backend.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="archive-confirm">Slug confirmation</Label>
              <Input
                id="archive-confirm"
                value={archiveConfirm}
                onChange={(event) => setArchiveConfirm(event.target.value)}
                placeholder={detail.slug}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={archiveOrg}
                disabled={busy || archiveConfirm.trim() !== detail.slug || isArchived}
              >
                Archive org
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dialog === 'invite'} onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <form onSubmit={inviteMember}>
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  The invitee receives an onboarding email for this organization.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="member@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={inviteRoleId} onValueChange={(value) => setInviteRoleId(value ?? '')}>
                    <SelectTrigger aria-label="Invite role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {detail.availableRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setDialog(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || !inviteEmail.trim() || !inviteRoleId}>
                  Send invite
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove member</DialogTitle>
              <DialogDescription>
                {removeTarget
                  ? `${removeTarget.email} will be soft-deleted from this organization.`
                  : 'This member will be removed from the organization.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={removeMember} disabled={busy || !removeTarget}>
                Remove member
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change role</DialogTitle>
              <DialogDescription>
                {roleTarget ? `Update ${roleTarget.email}'s organization role.` : 'Update this member role.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={roleId} onValueChange={(value) => setRoleId(value ?? '')}>
                <SelectTrigger aria-label="Member role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {detail.availableRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleTarget(null)} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={changeMemberRole} disabled={busy || !roleTarget || !roleId}>
                Save role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

function OrgActionMenu({
  archived,
  canToggleSso,
  ssoEnabled,
  busy,
  onPlan,
  onToggleSso,
  onTransfer,
  onArchive,
}: {
  archived: boolean
  canToggleSso: boolean
  ssoEnabled: boolean
  busy: boolean
  onPlan: () => void
  onToggleSso: () => void
  onTransfer: () => void
  onArchive: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={busy} />}>
        <MoreHorizontal className="h-4 w-4" />
        Actions
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem disabled={archived} onClick={onPlan}>
          <ChevronDown className="h-4 w-4" />
          Change plan
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canToggleSso} onClick={onToggleSso}>
          <ShieldCheck className="h-4 w-4" />
          {ssoEnabled ? 'Disable SSO' : 'Enable SSO'}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={archived} onClick={onTransfer}>
          <UserRound className="h-4 w-4" />
          Transfer ownership
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={archived} variant="destructive" onClick={onArchive}>
          <Archive className="h-4 w-4" />
          Archive org
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function OverviewTab({ detail }: { detail: AdminOrgDetail }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Members" value={detail.stats.memberCount.toLocaleString()} />
        <StatCard label="Extractions" value={detail.stats.extractionCount.toLocaleString()} />
        <StatCard label="Recall sessions" value={detail.stats.recallSessionCount.toLocaleString()} />
        <StatCard label="MRR" value={formatCurrency(detail.stats.mrr)} />
      </div>
      <Card>
        <CardContent className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Owner" value={detail.owner ? `${detail.owner.name} (${detail.owner.email})` : null} />
          <Field label="Slug" value={<span className="font-mono">{detail.slug}</span>} />
          <Field label="SSO" value={detail.ssoEnabled ? 'Enabled' : 'Disabled'} />
          <Field label="Created" value={formatDateTime(detail.createdAt)} />
          <Field label="Updated" value={formatDateTime(detail.updatedAt)} />
          <Field label="Status" value={detail.deletedAt ? `Archived ${formatDateTime(detail.deletedAt)}` : 'Active'} />
        </CardContent>
      </Card>
    </div>
  )
}

function MembersTab({
  members,
  ownerId,
  roles,
  nextCursor,
  busy,
  onInvite,
  onLoadMore,
  onRemove,
  onChangeRole,
}: {
  members: AdminOrgMember[]
  ownerId: string | null
  roles: AdminOrgRoleOption[]
  nextCursor: string | null
  busy: boolean
  onInvite: () => void
  onLoadMore: () => void
  onRemove: (member: AdminOrgMember) => void
  onChangeRole: (member: AdminOrgMember) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Members</CardTitle>
          <Button onClick={onInvite} disabled={roles.length === 0}>
            <Plus className="h-4 w-4" />
            Invite member
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Role</th>
                <th className="px-3 py-3">Joined</th>
                <th className="px-3 py-3">Last active</th>
                <th className="w-12 px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No active members found.
                  </td>
                </tr>
              )}
              {members.map((member) => {
                const isOwner = member.id === ownerId
                return (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
                          <AvatarFallback>{initials(member.name || member.email)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium">{member.name || 'Unnamed member'}</div>
                          {isOwner && <Badge variant="outline">Owner</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{member.email}</td>
                    <td className="px-3 py-3">
                      <Badge variant={member.systemRole === 'ORG_ADMIN' ? 'secondary' : 'outline'}>
                        {member.role}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">{formatDate(member.joinedAt)}</td>
                    <td className="px-3 py-3">{relativeTime(member.lastActiveAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.email}`} />}>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={roles.length === 0} onClick={() => onChangeRole(member)}>
                            Change role
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={isOwner}
                            variant="destructive"
                            onClick={() => onRemove(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove member
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {nextCursor && (
          <div className="border-t p-3 text-center">
            <Button variant="outline" onClick={onLoadMore} disabled={busy}>
              Load more members
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SubscriptionTab({ detail, onChangePlan }: { detail: AdminOrgDetail; onChangePlan: () => void }) {
  return (
    <Card>
      <CardContent className="grid gap-5 p-5 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Plan" value={<Badge variant="secondary">{formatPlan(detail.plan)}</Badge>} />
        <Field label="Billing cycle" value={detail.billingCycle ? formatEnum(detail.billingCycle) : 'None'} />
        <Field label="Next renewal" value={formatDateTime(detail.nextRenewal)} />
        <Field label="MRR" value={formatCurrency(detail.stats.mrr)} />
        <Field
          label="Billing"
          value={
            <Link href="/admin/billing" className="font-medium text-primary hover:underline">
              Open billing overview
            </Link>
          }
        />
        <div className="flex items-end">
          <Button onClick={onChangePlan}>Change plan</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SettingsTab({
  detail,
  settings,
  setSettings,
  error,
  busy,
  onSubmit,
  onArchive,
}: {
  detail: AdminOrgDetail
  settings: { name: string; slug: string; type: AdminOrgType; ssoEnabled: boolean }
  setSettings: React.Dispatch<React.SetStateAction<{ name: string; slug: string; type: AdminOrgType; ssoEnabled: boolean }>>
  error: string | null
  busy: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onArchive: () => void
}) {
  const ssoAvailable = settings.type === 'ENTERPRISE'
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Organization settings</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Name</Label>
              <Input
                id="org-name"
                value={settings.name}
                onChange={(event) => setSettings((current) => ({ ...current, name: event.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="org-slug">Slug</Label>
              <Input
                id="org-slug"
                value={settings.slug}
                onChange={(event) => setSettings((current) => ({ ...current, slug: event.target.value.toLowerCase() }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={settings.type}
                onValueChange={(value) => setSettings((current) => ({ ...current, type: value as AdminOrgType }))}
              >
                <SelectTrigger aria-label="Organization type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {formatEnum(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Tooltip>
                <TooltipTrigger render={<span className="inline-flex" />}>
                  <Label className="h-9 rounded-lg border border-input px-3">
                    <Checkbox
                      aria-label="SSO enabled"
                      checked={ssoAvailable && settings.ssoEnabled}
                      disabled={!ssoAvailable}
                      onCheckedChange={(checked) =>
                        setSettings((current) => ({ ...current, ssoEnabled: checked === true }))
                      }
                    />
                    SSO enabled
                  </Label>
                </TooltipTrigger>
                {!ssoAvailable && <TooltipContent>SSO is only available for Enterprise organizations.</TooltipContent>}
              </Tooltip>
            </div>
            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive md:col-span-2">
                {error}
              </p>
            )}
            <div className="md:col-span-2">
              <Button type="submit" disabled={busy || Boolean(detail.deletedAt)}>
                Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium">Archive organization</div>
            <div className="text-sm text-muted-foreground">
              Soft-archives the organization and cancels active subscriptions.
            </div>
          </div>
          <Button variant="destructive" disabled={Boolean(detail.deletedAt)} onClick={onArchive}>
            <Archive className="h-4 w-4" />
            Archive org
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? <span className="text-muted-foreground">None</span>}</div>
    </div>
  )
}

function StatusBadge({ archived }: { archived: boolean }) {
  if (archived) return <Badge variant="outline">Archived</Badge>
  return <Badge variant="secondary">Active</Badge>
}

function defaultRoleId(roles: AdminOrgRoleOption[]) {
  return roles.find((role) => role.name === 'Member')?.id ?? roles[0]?.id ?? ''
}

function initials(value: string) {
  return value
    .split(/\s|@|-/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatPlan(value: AdminSubscriptionPlan) {
  if (value === 'PRO') return 'Pro'
  return formatEnum(value)
}

function formatDate(value: string) {
  return format(new Date(value), 'MMM d, yyyy')
}

function formatDateTime(value: string | null) {
  if (!value) return null
  return format(new Date(value), 'PP p')
}

function relativeTime(value: string | null) {
  if (!value) return 'Never'
  return formatDistanceToNow(new Date(value), { addSuffix: true })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}
