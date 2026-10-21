'use client'
import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { BookOpen, CalendarDays, Library, Users, GraduationCap, ShieldCheck } from 'lucide-react'
import { RoleShell } from '@/components/roles/role-shell'
import type { Workspace } from '@/lib/api/school'

export function SchoolShell({
  workspace,
  identity,
  children,
}: {
  workspace: Workspace
  identity?: string | null
  children: React.ReactNode
}) {
  const base = `/org/${encodeURIComponent(workspace.schoolId)}`
  const admin = workspace.role === 'SCHOOL_ADMIN'
  const items = admin
    ? [
        {
          href: `${base}/academics`,
          label: 'Academic structure',
          icon: CalendarDays,
        },
        {
          href: `${base}/curriculum`,
          label: 'Curriculum & subjects',
          icon: Library,
        },
        {
          href: `${base}/students`,
          label: 'Students & guardians',
          icon: Users,
        },
        {
          href: `${base}/staff`,
          label: 'Teachers & staff',
          icon: GraduationCap,
        },
        { href: `${base}/policies`, label: 'Learning & AI policies', icon: ShieldCheck },
      ]
    : [
        {
          href: `${base}/classroom`,
          label: 'My teaching assignments',
          icon: BookOpen,
        },
      ]
  return (
    <RoleShell
      role={admin ? 'school-admin' : 'teacher'}
      band="adults"
      workspaceName={workspace.schoolName}
      identity={identity}
      homeHref={items[0]?.href ?? '/workspaces'}
      navigation={[{ title: 'School', items }]}
      accountActions={
        <div className="flex flex-wrap gap-2">
          <Link href="/workspaces" className="ds-button ds-button-secondary">
            Switch workspace
          </Link>
          <button
            className="ds-button ds-button-ghost"
            onClick={() => void signOut({ redirectTo: '/login' })}
          >
            Sign out
          </button>
        </div>
      }
    >
      <div className="mx-auto min-w-0 max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
    </RoleShell>
  )
}
