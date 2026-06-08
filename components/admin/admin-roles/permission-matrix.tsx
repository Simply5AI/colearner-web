'use client'

import { useMemo } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { AdminPermission, AdminPermissionsGrouped } from '@/lib/api/admin'

const ACTION_ORDER = ['manage', 'create', 'read', 'update', 'delete'] as const

const SUBJECT_ORDER = [
  'all',
  'Admin',
  'User',
  'Org',
  'Role',
  'Billing',
  'Extraction',
  'Concept',
  'Question',
  'RecallSession',
  'ReviewSchedule',
  'Mastery',
  'Notification',
  'AuditLog',
  'Onboarding',
  'Topic',
  'Subject',
  'Pod',
] as const

interface PermissionMatrixProps {
  catalog: AdminPermissionsGrouped
  selectedIds: Set<string>
  disabled?: boolean
  onChange?: (permissionId: string, checked: boolean) => void
  className?: string
}

export function PermissionMatrix({
  catalog,
  selectedIds,
  disabled = false,
  onChange,
  className,
}: PermissionMatrixProps) {
  const manageAllId = useMemo(() => {
    for (const group of catalog.groups) {
      const match = group.permissions.find(
        (permission) => permission.action === 'manage' && permission.subject === 'all'
      )
      if (match) return match.id
    }
    return null
  }, [catalog.groups])

  const hasManageAll = manageAllId ? selectedIds.has(manageAllId) : false

  const rows = useMemo(() => buildMatrixRows(catalog), [catalog])

  const actions = useMemo(() => {
    const actionSet = new Set<string>()
    for (const row of rows) {
      for (const action of Object.keys(row.actions)) {
        actionSet.add(action)
      }
    }
    return ACTION_ORDER.filter((action) => actionSet.has(action))
  }, [rows])

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No permissions are defined in the catalog.</p>
    )
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border', className)}>
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Subject</th>
            {actions.map((action) => (
              <th key={action} className="px-3 py-2 text-center font-semibold capitalize text-muted-foreground">
                {action}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subject} className="border-b border-border/70 last:border-b-0">
              <td className="px-3 py-2 font-medium">{row.label}</td>
              {actions.map((action) => {
                const permission = row.actions[action]
                if (!permission) {
                  return <td key={action} className="px-3 py-2 text-center text-muted-foreground/30">—</td>
                }

                const checked = hasManageAll || selectedIds.has(permission.id)

                return (
                  <td key={action} className="px-3 py-2 text-center">
                    <Checkbox
                      checked={checked}
                      disabled={disabled || hasManageAll}
                      aria-label={`${permission.action} ${permission.subject}`}
                      onCheckedChange={(value) => onChange?.(permission.id, value === true)}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildMatrixRows(catalog: AdminPermissionsGrouped) {
  const bySubject = new Map<string, Record<string, AdminPermission>>()

  for (const group of catalog.groups) {
    const actions: Record<string, AdminPermission> = {}
    for (const permission of group.permissions) {
      actions[permission.action] = permission
    }
    bySubject.set(group.subject, actions)
  }

  const orderedSubjects = [
    ...SUBJECT_ORDER.filter((subject) => bySubject.has(subject)),
    ...Array.from(bySubject.keys())
      .filter((subject) => !SUBJECT_ORDER.includes(subject as (typeof SUBJECT_ORDER)[number]))
      .sort((a, b) => a.localeCompare(b)),
  ]

  return orderedSubjects.map((subject) => ({
    subject,
    label: subject === 'all' ? 'All (wildcard)' : subject,
    actions: bySubject.get(subject) ?? {},
  }))
}
