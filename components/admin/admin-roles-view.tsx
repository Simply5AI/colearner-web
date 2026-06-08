'use client'

import type { FormEvent } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { format } from 'date-fns'
import { Lock, Plus, RefreshCw, Search, Shield, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  createAdminRole,
  deleteAdminRole,
  getAdminOrgs,
  updateAdminRole,
  type AdminOrgListRow,
  type AdminPermissionsGrouped,
  type AdminRoleListItem,
  type AdminRolesResponse,
} from '@/lib/api/admin'
import { PermissionMatrix } from '@/components/admin/admin-roles/permission-matrix'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface AdminRolesViewProps {
  data: AdminRolesResponse
  permissions: AdminPermissionsGrouped
  selectedRoleId?: string
}

interface CreateRoleForm {
  name: string
  description: string
  orgId: string
}

type CreateRoleErrors = Partial<Record<keyof CreateRoleForm, string>> & { form?: string }

const emptyCreateForm: CreateRoleForm = {
  name: '',
  description: '',
  orgId: '',
}

export function AdminRolesView({ data, permissions, selectedRoleId }: AdminRolesViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateRoleForm>(emptyCreateForm)
  const [createPermissionIds, setCreatePermissionIds] = useState<Set<string>>(new Set())
  const [createErrors, setCreateErrors] = useState<CreateRoleErrors>({})
  const [orgOptions, setOrgOptions] = useState<AdminOrgListRow[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AdminRoleListItem | null>(null)
  const [isMutating, setIsMutating] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPermissionIds, setEditPermissionIds] = useState<Set<string>>(new Set())

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data.items
    return data.items.filter((role) => {
      const haystack = [role.name, role.description ?? '', role.orgName ?? ''].join(' ').toLowerCase()
      return haystack.includes(term)
    })
  }, [data.items, search])

  const systemRoles = useMemo(
    () => filteredRoles.filter((role) => role.isSystem),
    [filteredRoles]
  )

  const customRolesByOrg = useMemo(() => {
    const groups = new Map<string, AdminRoleListItem[]>()
    for (const role of filteredRoles.filter((role) => !role.isSystem)) {
      const key = role.orgName ?? 'Unknown organization'
      const bucket = groups.get(key) ?? []
      bucket.push(role)
      groups.set(key, bucket)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredRoles])

  const selectedRole = useMemo(() => {
    if (!selectedRoleId) return data.items[0] ?? null
    return data.items.find((role) => role.id === selectedRoleId) ?? data.items[0] ?? null
  }, [data.items, selectedRoleId])

  useEffect(() => {
    if (!selectedRole) return
    setEditMode(false)
    setEditName(selectedRole.name)
    setEditDescription(selectedRole.description ?? '')
    setEditPermissionIds(new Set(selectedRole.permissionIds))
  }, [selectedRole])

  const selectRole = (roleId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('role', roleId)
    startTransition(() => {
      router.replace(`/admin/roles?${params.toString()}`, { scroll: false })
    })
  }

  const authHeaders = useMemo(() => {
    if (!session?.accessToken) return null
    return { Authorization: `Bearer ${session.accessToken}` }
  }, [session?.accessToken])

  const openCreateSheet = async () => {
    setCreateForm(emptyCreateForm)
    setCreatePermissionIds(new Set())
    setCreateErrors({})
    setCreateOpen(true)

    if (!authHeaders || orgOptions.length > 0) return

    setOrgsLoading(true)
    try {
      const orgs = await getAdminOrgs(authHeaders, { limit: 100, sort: 'created_desc' })
      setOrgOptions(orgs.items)
      if (orgs.items[0]) {
        setCreateForm((current) => ({ ...current, orgId: orgs.items[0].id }))
      }
    } catch (error) {
      toast.error('Failed to load organizations', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setOrgsLoading(false)
    }
  }

  const toggleCreatePermission = (permissionId: string, checked: boolean) => {
    setCreatePermissionIds((current) => {
      const next = new Set(current)
      if (checked) next.add(permissionId)
      else next.delete(permissionId)
      return next
    })
  }

  const toggleEditPermission = (permissionId: string, checked: boolean) => {
    setEditPermissionIds((current) => {
      const next = new Set(current)
      if (checked) next.add(permissionId)
      else next.delete(permissionId)
      return next
    })
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const errors: CreateRoleErrors = {}
    if (!createForm.name.trim()) errors.name = 'Name is required'
    if (!createForm.orgId) errors.orgId = 'Organization is required'
    setCreateErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!authHeaders) {
      toast.error('Unable to create role', { description: 'Missing admin session token.' })
      return
    }

    setIsMutating(true)
    try {
      const created = await createAdminRole(authHeaders, {
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        orgId: createForm.orgId,
        permissionIds: Array.from(createPermissionIds),
      })
      toast.success('Role created', { description: `${created.name} is ready to assign.` })
      setCreateOpen(false)
      const params = new URLSearchParams(searchParams.toString())
      params.set('role', created.id)
      router.replace(`/admin/roles?${params.toString()}`)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.'
      if (/already exists/i.test(message)) {
        setCreateErrors((current) => ({ ...current, name: message }))
      } else {
        setCreateErrors((current) => ({ ...current, form: message }))
      }
      toast.error('Role was not created', { description: message })
    } finally {
      setIsMutating(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!selectedRole || selectedRole.isSystem || !authHeaders) return
    if (!editName.trim()) {
      toast.error('Role name is required')
      return
    }

    setIsMutating(true)
    try {
      await updateAdminRole(authHeaders, selectedRole.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        permissionIds: Array.from(editPermissionIds),
        updatedAt: selectedRole.updatedAt,
      })
      toast.success('Role updated')
      setEditMode(false)
      router.refresh()
    } catch (error) {
      toast.error('Update failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsMutating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !authHeaders) return

    setIsMutating(true)
    try {
      await deleteAdminRole(authHeaders, deleteTarget.id)
      toast.success('Role deleted', { description: `${deleteTarget.name} was removed.` })
      setDeleteTarget(null)
      const params = new URLSearchParams(searchParams.toString())
      if (params.get('role') === deleteTarget.id) {
        params.delete('role')
      }
      router.replace(`/admin/roles${params.toString() ? `?${params.toString()}` : ''}`)
      router.refresh()
    } catch (error) {
      toast.error('Delete failed', {
        description: error instanceof Error ? error.message : 'Please try again.',
      })
    } finally {
      setIsMutating(false)
    }
  }

  return (
    <>
      <div className="px-4 py-5 md:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Roles & permissions</h1>
              <Badge variant="outline">{data.items.length.toLocaleString()} roles</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Review system roles and manage custom organization roles platform-wide.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.refresh()} disabled={isPending}>
              <RefreshCw className={cn('h-4 w-4', isPending && 'animate-spin')} />
              Refresh
            </Button>
            <Button onClick={openCreateSheet}>
              <Plus className="h-4 w-4" />
              New role
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="my-0">
            <CardContent className="space-y-4 p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search roles or organizations"
                  className="pl-9"
                />
              </div>

              <div className="space-y-4">
                <RoleGroup
                  title="System roles"
                  roles={systemRoles}
                  selectedRoleId={selectedRole?.id}
                  onSelect={selectRole}
                />

                {customRolesByOrg.map(([orgName, roles]) => (
                  <RoleGroup
                    key={orgName}
                    title={orgName}
                    roles={roles}
                    selectedRoleId={selectedRole?.id}
                    onSelect={selectRole}
                  />
                ))}

                {filteredRoles.length === 0 && (
                  <p className="px-1 text-sm text-muted-foreground">No roles match your search.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="my-0">
            <CardContent className="space-y-5 p-4 md:p-5">
              {!selectedRole ? (
                <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                  Select a role to inspect its permissions.
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      {editMode ? (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-role-name">Name</Label>
                            <Input
                              id="edit-role-name"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="edit-role-description">Description</Label>
                            <Textarea
                              id="edit-role-description"
                              value={editDescription}
                              onChange={(event) => setEditDescription(event.target.value)}
                              rows={3}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedRole.isSystem ? (
                              <Lock className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Shield className="h-4 w-4 text-muted-foreground" />
                            )}
                            <h2 className="text-xl font-semibold">{selectedRole.name}</h2>
                            <Badge variant="secondary">
                              {selectedRole.isSystem ? 'System' : selectedRole.orgName ?? 'Organization'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedRole.description || 'No description provided.'}
                          </p>
                        </>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{selectedRole.assigneeCount} assignee{selectedRole.assigneeCount === 1 ? '' : 's'}</span>
                        <span>Updated {format(new Date(selectedRole.updatedAt), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedRole.isSystem ? (
                        <Badge variant="outline" className="h-8 px-3">
                          <Lock className="mr-1 h-3.5 w-3.5" />
                          Read only
                        </Badge>
                      ) : editMode ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setEditMode(false)
                              setEditName(selectedRole.name)
                              setEditDescription(selectedRole.description ?? '')
                              setEditPermissionIds(new Set(selectedRole.permissionIds))
                            }}
                            disabled={isMutating}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleSaveEdit} disabled={isMutating}>
                            Save changes
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" onClick={() => setEditMode(true)}>
                            Edit
                          </Button>
                          <DeleteRoleButton
                            role={selectedRole}
                            disabled={isMutating}
                            onClick={() => setDeleteTarget(selectedRole)}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Permission matrix</h3>
                    <PermissionMatrix
                      catalog={permissions}
                      selectedIds={editMode ? editPermissionIds : new Set(selectedRole.permissionIds)}
                      disabled={selectedRole.isSystem || !editMode}
                      onChange={editMode ? toggleEditPermission : undefined}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Create custom role</SheetTitle>
            <SheetDescription>
              Define a new organization-scoped role and choose its permission set.
            </SheetDescription>
          </SheetHeader>

          <form className="mt-6 space-y-5" onSubmit={handleCreate}>
            <div className="space-y-1.5">
              <Label htmlFor="create-role-name">Name</Label>
              <Input
                id="create-role-name"
                value={createForm.name}
                onChange={(event) => {
                  setCreateForm((current) => ({ ...current, name: event.target.value }))
                  setCreateErrors((current) => ({ ...current, name: undefined, form: undefined }))
                }}
              />
              {createErrors.name && <p className="text-xs text-destructive">{createErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role-description">Description</Label>
              <Textarea
                id="create-role-description"
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Organization</Label>
              <Select
                value={createForm.orgId}
                onValueChange={(value) => {
                  setCreateForm((current) => ({ ...current, orgId: value }))
                  setCreateErrors((current) => ({ ...current, orgId: undefined, form: undefined }))
                }}
                disabled={orgsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={orgsLoading ? 'Loading organizations...' : 'Select organization'} />
                </SelectTrigger>
                <SelectContent>
                  {orgOptions.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createErrors.orgId && <p className="text-xs text-destructive">{createErrors.orgId}</p>}
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <PermissionMatrix
                catalog={permissions}
                selectedIds={createPermissionIds}
                onChange={toggleCreatePermission}
              />
            </div>

            {createErrors.form && <p className="text-sm text-destructive">{createErrors.form}</p>}

            <SheetFooter>
              <Button type="submit" disabled={isMutating || orgsLoading}>
                Create role
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name}" from ${deleteTarget.orgName ?? 'this organization'}? This cannot be undone.`
                : 'Delete this role?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isMutating}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isMutating}>
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RoleGroup({
  title,
  roles,
  selectedRoleId,
  onSelect,
}: {
  title: string
  roles: AdminRoleListItem[]
  selectedRoleId?: string
  onSelect: (roleId: string) => void
}) {
  if (roles.length === 0) return null

  return (
    <div>
      <p className="px-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {title}
      </p>
      <div className="space-y-1">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => onSelect(role.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              selectedRoleId === role.id
                ? 'bg-primary/10 font-semibold text-primary'
                : 'text-foreground hover:bg-muted/60'
            )}
          >
            {role.isSystem ? (
              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">{role.name}</span>
            <span className="text-xs text-muted-foreground">{role.assigneeCount}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function DeleteRoleButton({
  role,
  disabled,
  onClick,
}: {
  role: AdminRoleListItem
  disabled?: boolean
  onClick: () => void
}) {
  const blocked = role.assigneeCount > 0
  const blockedMessage = blocked
    ? `${role.assigneeCount} user${role.assigneeCount === 1 ? '' : 's'} still assigned — reassign first`
    : undefined

  return (
    <Button
      variant="destructive"
      onClick={onClick}
      disabled={disabled || blocked}
      title={blockedMessage}
      aria-label={blockedMessage ? `Delete role (${blockedMessage})` : 'Delete role'}
    >
      <Trash2 className="h-4 w-4" />
      Delete
    </Button>
  )
}
