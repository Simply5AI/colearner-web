'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { format } from 'date-fns'

import {
  assignAdminUserRole,
  revokeAdminUserRole,
  type AdminUserDetail,
} from '@/lib/api/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RolesTabProps {
  detail: AdminUserDetail
  currentAdminId: string
  authHeaders: Record<string, string>
}

export function RolesTab({ detail, currentAdminId, authHeaders }: RolesTabProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedRoleId, setSelectedRoleId] = useState<string>('')
  const [busy, setBusy] = useState<string | null>(null) // tracks which row is mutating
  const isSelf = detail.id === currentAdminId

  const assignedRoleIds = useMemo(
    () => new Set(detail.roles.map((r) => r.roleId)),
    [detail.roles]
  )

  const availableForAssign = useMemo(
    () => detail.availableRoles.filter((r) => !assignedRoleIds.has(r.id)),
    [detail.availableRoles, assignedRoleIds]
  )

  const systemRoles = availableForAssign.filter((r) => r.isSystem)
  const orgRoles = availableForAssign.filter((r) => !r.isSystem)

  const refresh = () => startTransition(() => router.refresh())

  const assign = async () => {
    if (!selectedRoleId) return
    setBusy('assign')
    try {
      await assignAdminUserRole(authHeaders, detail.id, selectedRoleId)
      toast.success('Role assigned')
      setSelectedRoleId('')
      refresh()
    } catch (error) {
      toast.error('Failed to assign role', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (roleId: string, roleName: string) => {
    setBusy(roleId)
    try {
      await revokeAdminUserRole(authHeaders, detail.id, roleId)
      toast.success(`Revoked ${roleName}`)
      refresh()
    } catch (error) {
      toast.error('Failed to revoke role', {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex items-end gap-3 p-4">
          <div className="flex-1 space-y-1">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Assign role
            </div>
            <Select
              value={selectedRoleId}
              onValueChange={(value) => setSelectedRoleId(value ?? '')}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    availableForAssign.length === 0
                      ? 'No additional roles available'
                      : 'Select a role…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableForAssign.length === 0 && (
                  <SelectItem value="__none" disabled>
                    No roles to assign — all available roles are already attached
                  </SelectItem>
                )}
                {systemRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                    <span className="ml-2 text-xs text-muted-foreground">system</span>
                  </SelectItem>
                ))}
                {orgRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                    <span className="ml-2 text-xs text-muted-foreground">org</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={assign}
            disabled={!selectedRoleId || busy === 'assign' || isPending}
          >
            <Plus className="h-4 w-4" />
            Assign
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {detail.roles.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No roles assigned
                  </td>
                </tr>
              )}
              {detail.roles.map((ra) => {
                const isSuperAdmin = ra.isSystem && ra.roleName === 'SUPER_ADMIN'
                const disabled = isSelf || isSuperAdmin || busy === ra.roleId
                return (
                  <tr key={ra.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{ra.roleName}</span>
                        {ra.isSystem && <Badge variant="secondary">system</Badge>}
                      </div>
                      {ra.description && (
                        <div className="text-xs text-muted-foreground">{ra.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ra.orgName ?? 'Global'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(ra.assignedAt), 'PP')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => revoke(ra.roleId, ra.roleName)}
                        title={
                          isSuperAdmin
                            ? 'SUPER_ADMIN cannot be revoked here'
                            : isSelf
                              ? 'Cannot revoke roles from your own account'
                              : undefined
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Revoke
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
