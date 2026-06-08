import type { Metadata } from 'next'
import { getAuthHeaders } from '@/lib/api/auth-headers'
import { getAdminPermissions, getAdminRoles } from '@/lib/api/admin'
import { AdminRolesView } from '@/components/admin/admin-roles-view'

export const metadata: Metadata = {
  title: 'Admin Roles & Permissions',
}

type AdminRolesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdminRolesPage({ searchParams }: AdminRolesPageProps) {
  const [params, headers] = await Promise.all([searchParams, getAuthHeaders()])
  const selectedRoleId = first(params.role)

  const [data, permissions] = await Promise.all([
    getAdminRoles(headers),
    getAdminPermissions(headers),
  ])

  return (
    <AdminRolesView
      data={data}
      permissions={permissions}
      selectedRoleId={selectedRoleId}
    />
  )
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}
